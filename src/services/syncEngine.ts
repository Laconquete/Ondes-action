import { db } from './localDatabase';
import { getSupabase } from './supabaseClient';
import { OutboxItem } from '../types/clinical';

/**
 * Moteur de Synchronisation Bidirectionnelle (Offline-First)
 *
 * Architecture :
 *
 *   ┌──────────────┐     PUSH      ┌──────────────┐
 *   │  IndexedDB   │ ────────────► │   Supabase   │
 *   │  (Dexie)     │ ◄──────────── │   (Postgres) │
 *   └──────────────┘     PULL      └──────────────┘
 *          │                              │
 *      outbox_items                   RLS policies
 *      (idempotencyKey)              (tenant isolation)
 *
 * PUSH (Local → Supabase) :
 *  1. Lire les outbox items avec status='pending', triés par createdAt
 *  2. Pour chaque item :
 *     - Mapper aggregateType → table Supabase
 *     - INSERT : si 23505 (unique_violation) → déjà appliqué, marquer 'applied'
 *     - UPDATE : upsert par id (LWW basé sur updated_at)
 *     - Succès → marquer 'applied' + appliedAt
 *     - Échec → marquer 'failed' + errorMessage
 *
 * PULL (Supabase → Local) :
 *  1. Pour chaque table, SELECT * WHERE tenant_id = ? AND updated_at > lastSyncTime
 *  2. Upsert chaque ligne en local (Dexie)
 *  3. Mettre à jour lastSyncTime avec le max(updated_at) vu
 *
 * Audit events : PUSH ONLY (jamais de pull — la chaîne locale est autoritaire).
 * Signed clinical notes : immuables, jamais écrasés par le pull.
 *
 * Idempotency :
 *  - Chaque outbox item a un idempotencyKey unique
 *  - Si le même item est rejoué (après crash réseau), Supabase refuse le doublon (23505)
 *  - On marque alors l'item comme 'applied' sans erreur
 */

// ============================================================
// MAPPING : aggregateType → table Supabase
// ============================================================

const AGGREGATE_TO_TABLE: Record<string, string> = {
  patient: 'patients',
  appointment: 'appointments',
  clinical_note: 'clinical_notes',
  clinical_addendum: 'clinical_addenda',
  medication_order: 'medication_orders',
  follow_up_task: 'follow_up_tasks',
  audit_event: 'audit_events',
  secure_conversation: 'secure_conversations',
  secure_message: 'secure_messages',
  break_glass_event: 'break_glass_events',
};

// Tables à tirer (pull) depuis Supabase. audit_events est EXCLU (push-only).
const PULLABLE_TABLES = [
  'patients',
  'appointments',
  'clinical_notes',
  'clinical_addenda',
  'medication_orders',
  'follow_up_tasks',
  'secure_conversations',
  'secure_messages',
  'break_glass_events',
];

// ============================================================
// TYPES
// ============================================================

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
  isConfigured: boolean;
  lastError: string | null;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  failed: number;
  durationMs: number;
  errors: string[];
}

// ============================================================
// GESTION DU lastSyncTime (localStorage)
// ============================================================

function getSyncMetaKey(tenantId: string, table: string): string {
  return `onedesk:sync:${tenantId}:${table}:lastSyncAt`;
}

function getLastSyncTime(tenantId: string, table: string): string | null {
  return localStorage.getItem(getSyncMetaKey(tenantId, table));
}

function setLastSyncTime(tenantId: string, table: string, timestamp: string): void {
  localStorage.setItem(getSyncMetaKey(tenantId, table), timestamp);
}

function getGlobalLastSyncAt(tenantId: string): string | null {
  return localStorage.getItem(`onedesk:sync:${tenantId}:global:lastSyncAt`);
}

function setGlobalLastSyncAt(tenantId: string, timestamp: string): void {
  localStorage.setItem(`onedesk:sync:${tenantId}:global:lastSyncAt`, timestamp);
}

// ============================================================
// PUSH : Outbox → Supabase
// ============================================================

/**
 * Pousse un seul outbox item vers Supabase.
 * @returns true si l'item a été appliqué avec succès (ou était déjà appliqué)
 */
async function pushSingleItem(
  item: OutboxItem & { tenantId: string },
  supabase: NonNullable<ReturnType<typeof getSupabase>>
): Promise<{ success: boolean; error?: string }> {
  const tableName = AGGREGATE_TO_TABLE[item.aggregateType];
  if (!tableName) {
    return { success: false, error: `Type d'agrégat inconnu: ${item.aggregateType}` };
  }

  const payload = {
    ...item.payload,
    tenant_id: item.tenantId, // RLS utilise ce champ pour l'isolation
  };

  try {
    if (item.operationType === 'INSERT') {
      const { error } = await supabase.from(tableName).insert(payload);

      if (error) {
        // 23505 = unique_violation → l'item a déjà été inséré (idempotency réussie)
        if (error.code === '23505') {
          return { success: true };
        }
        return { success: false, error: `${error.code}: ${error.message}` };
      }
      return { success: true };
    }

    if (item.operationType === 'UPDATE') {
      // Upsert : si la ligne n'existe pas encore côté Supabase, on l'insère.
      const { error } = await supabase
        .from(tableName)
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        return { success: false, error: `${error.code}: ${error.message}` };
      }
      return { success: true };
    }

    if (item.operationType === 'DELETE') {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', item.aggregateId)
        .eq('tenant_id', item.tenantId);

      if (error) {
        return { success: false, error: `${error.code}: ${error.message}` };
      }
      return { success: true };
    }

    return { success: false, error: `Opération inconnue: ${item.operationType}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur réseau inconnue',
    };
  }
}

/**
 * Pousse tous les outbox items en attente vers Supabase.
 *
 * @param tenantId Le tenant concerné
 * @returns Nombre d'items poussés avec succès
 */
export async function pushOutbox(tenantId: string): Promise<{ pushed: number; failed: number; errors: string[] }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { pushed: 0, failed: 0, errors: ['Supabase non configuré'] };
  }

  // Lire les items en attente, triés par date de création (FIFO)
  const pendingItems = await db.outboxItems
    .where('[tenantId+status]')
    .equals([tenantId, 'pending'])
    .sortBy('createdAt');

  let pushed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of pendingItems) {
    const result = await pushSingleItem(item, supabase);

    if (result.success) {
      await db.outboxItems.update(item.id, {
        status: 'applied',
        appliedAt: new Date().toISOString(),
      });
      pushed++;
    } else {
      await db.outboxItems.update(item.id, {
        status: 'failed',
        errorMessage: result.error,
      });
      failed++;
      if (result.error) errors.push(`${item.aggregateType}/${item.aggregateId}: ${result.error}`);
    }
  }

  return { pushed, failed, errors };
}

// ============================================================
// PULL : Supabase → Local (IndexedDB)
// ============================================================

/**
 * Map entre nom de table Supabase et table Dexie correspondante.
 */
function getDexieTable(tableName: string): keyof typeof db | null {
  const mapping: Record<string, keyof typeof db> = {
    patients: 'patients',
    appointments: 'appointments',
    clinical_notes: 'clinicalNotes',
    clinical_addenda: 'clinicalAddenda',
    medication_orders: 'medicationOrders',
    follow_up_tasks: 'followUpTasks',
    secure_conversations: 'secureConversations',
    secure_messages: 'secureMessages',
    break_glass_events: 'breakGlassEvents',
  };
  return mapping[tableName] || null;
}

/**
 * Tire les changements d'une table Supabase vers la base locale.
 * Utilise updated_at > lastSyncTime pour ne récupérer que les nouveautés.
 *
 * @returns Nombre de lignes upsertées en local
 */
async function pullTable(
  tableName: string,
  tenantId: string,
  supabase: NonNullable<ReturnType<typeof getSupabase>>
): Promise<{ pulled: number; error?: string }> {
  const dexieTable = getDexieTable(tableName);
  if (!dexieTable) {
    return { pulled: 0, error: `Table Dexie inconnue pour: ${tableName}` };
  }

  const lastSync = getLastSyncTime(tenantId, tableName);

  let query = supabase
    .from(tableName)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: true })
    .limit(500); // Safety cap — batch par 500 lignes

  if (lastSync) {
    query = query.gt('updated_at', lastSync);
  }

  const { data, error } = await query;

  if (error) {
    return { pulled: 0, error: `${error.code}: ${error.message}` };
  }

  if (!data || data.length === 0) {
    return { pulled: 0 };
  }

  // Upsert chaque ligne en local
  const dexieCollection = db[dexieTable] as unknown as {
    put: (item: Record<string, unknown>) => Promise<string>;
  };

  let maxUpdatedAt = lastSync || '1970-01-01T00:00:00Z';

  for (const row of data) {
    // LWW (Last-Write-Wins) : on écrase systématiquement la version locale.
    // Exception : les clinical_notes signées sont immuables — on ne les écrase pas
    // si le statut local est 'signed' et que la version distante est aussi 'signed'.
    if (tableName === 'clinical_notes') {
      const localRow = await (db.clinicalNotes as unknown as {
        get: (id: string) => Promise<{ status?: string } | undefined>;
      }).get(row.id);
      if (localRow?.status === 'signed' && row.status === 'signed') {
        // Note déjà signée localement — on conserve la version locale (pas d'écrasement)
        continue;
      }
    }

    await dexieCollection.put(row);

    if (row.updated_at && row.updated_at > maxUpdatedAt) {
      maxUpdatedAt = row.updated_at;
    }
  }

  setLastSyncTime(tenantId, tableName, maxUpdatedAt);
  return { pulled: data.length };
}

/**
 * Tire les changements de toutes les tables depuis Supabase.
 */
export async function pullAllTables(tenantId: string): Promise<{ pulled: number; errors: string[] }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { pulled: 0, errors: ['Supabase non configuré'] };
  }

  let totalPulled = 0;
  const errors: string[] = [];

  for (const tableName of PULLABLE_TABLES) {
    const result = await pullTable(tableName, tenantId, supabase);
    totalPulled += result.pulled;
    if (result.error) {
      errors.push(`${tableName}: ${result.error}`);
    }
  }

  setGlobalLastSyncAt(tenantId, new Date().toISOString());
  return { pulled: totalPulled, errors };
}

// ============================================================
// SYNC COMPLÈTE (Push + Pull)
// ============================================================

/**
 * Effectue une synchronisation complète : push de l'outbox puis pull des changements.
 *
 * @param tenantId Le tenant à synchroniser
 * @returns Résultat détaillé de la sync
 */
export async function fullSync(tenantId: string): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  // 1. PUSH d'abord (pour que nos changements locaux soient visibles côté serveur)
  const pushResult = await pushOutbox(tenantId);
  errors.push(...pushResult.errors);

  // 2. PULL ensuite (pour récupérer les changements des autres clients)
  const pullResult = await pullAllTables(tenantId);
  errors.push(...pullResult.errors);

  return {
    pushed: pushResult.pushed,
    pulled: pullResult.pulled,
    failed: pushResult.failed,
    durationMs: Date.now() - startTime,
    errors,
  };
}

// ============================================================
// STATUS
// ============================================================

/**
 * Retourne l'état courant de la sync pour un tenant.
 */
export async function getSyncStatus(tenantId: string): Promise<SyncStatus> {
  const supabase = getSupabase();
  const isConfigured = supabase !== null;

  let pendingCount = 0;
  let failedCount = 0;

  if (isConfigured) {
    pendingCount = await db.outboxItems
      .where('[tenantId+status]')
      .equals([tenantId, 'pending'])
      .count();
    failedCount = await db.outboxItems
      .where('[tenantId+status]')
      .equals([tenantId, 'failed'])
      .count();
  }

  return {
    isSyncing: false, // Mis à jour par le syncWorker
    lastSyncAt: getGlobalLastSyncAt(tenantId),
    pendingCount,
    failedCount,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isConfigured,
    lastError: null,
  };
}

/**
 * Nettoie les outbox items appliqués avec succès (pour libérer de l'espace).
 * Conserve les 100 derniers pour audit, supprime les plus anciens.
 */
export async function cleanupAppliedOutbox(tenantId: string): Promise<number> {
  const applied = await db.outboxItems
    .where('[tenantId+status]')
    .equals([tenantId, 'applied'])
    .toArray();

  if (applied.length <= 100) return 0;

  // Trier par appliedAt décroissant, supprimer tout sauf les 100 plus récents
  const sorted = applied.sort(
    (a, b) => new Date(b.appliedAt || '').getTime() - new Date(a.appliedAt || '').getTime()
  );
  const toDelete = sorted.slice(100);

  await db.outboxItems.bulkDelete(toDelete.map((item) => item.id));
  return toDelete.length;
}

/**
 * Remet à 'pending' tous les items 'failed' pour une nouvelle tentative.
 */
export async function retryFailedItems(tenantId: string): Promise<number> {
  const failed = await db.outboxItems
    .where('[tenantId+status]')
    .equals([tenantId, 'failed'])
    .toArray();

  if (failed.length === 0) return 0;

  await Promise.all(
    failed.map((item) =>
      db.outboxItems.update(item.id, { status: 'pending', errorMessage: undefined })
    )
  );

  return failed.length;
}

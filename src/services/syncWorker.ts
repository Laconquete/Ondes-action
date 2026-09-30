import { fullSync, getSyncStatus, SyncStatus } from './syncEngine';
import { isSupabaseConfigured } from './supabaseClient';

/**
 * Worker de Synchronisation — orchestre la sync en arrière-plan.
 *
 * Déclencheurs :
 *  1. Au démarrage de l'app (si online + configuré)
 *  2. Toutes les 30 secondes (polling)
 *  3. Sur l'événement `online` du navigateur (reconnexion réseau)
 *  4. Manuellement via triggerManualSync()
 *
 * Garanties :
 *  - Pas de sync simultanée (verrou via isSyncing)
 *  - Pas de sync si Supabase non configuré (mode offline)
 *  - Pas de sync si navigateur hors-ligne
 *  - Les erreurs sont loggées mais ne crashent pas l'app
 *  - Le statut est exposé via getSyncStatus() pour l'UI
 */

const SYNC_INTERVAL_MS = 30_000; // 30 secondes

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;
let currentTenantId: string | null = null;
let lastSyncResult: { pushed: number; pulled: number; failed: number; at: string } | null = null;
let lastError: string | null = null;

// Callbacks pour notifier l'UI (optionnel)
type StatusListener = (status: SyncStatus) => void;
const statusListeners = new Set<StatusListener>();

function notifyListeners(status: SyncStatus): void {
  for (const listener of statusListeners) {
    try {
      listener(status);
    } catch {
      // Ignore les erreurs de listener (ne doivent pas crasher le worker)
    }
  }
}

/**
 * Effectue une sync complète avec gestion du verrou.
 */
async function performSync(): Promise<void> {
  if (isSyncing) return; // Sync déjà en cours
  if (!currentTenantId) return; // Pas de tenant configuré
  if (!isSupabaseConfigured()) return; // Mode offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) return; // Hors-ligne

  isSyncing = true;
  lastError = null;

  try {
    const result = await fullSync(currentTenantId);
    lastSyncResult = {
      pushed: result.pushed,
      pulled: result.pulled,
      failed: result.failed,
      at: new Date().toISOString(),
    };

    if (result.errors.length > 0) {
      lastError = result.errors.join('; ');
      console.warn('[syncWorker] Sync terminée avec erreurs:', result.errors);
    } else if (result.pushed > 0 || result.pulled > 0) {
      console.info(
        `[syncWorker] Sync OK: ${result.pushed} poussé(s), ${result.pulled} tiré(s) en ${result.durationMs}ms`
      );
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[syncWorker] Échec sync:', err);
  } finally {
    isSyncing = false;

    // Notifier l'UI du nouveau statut
    if (currentTenantId) {
      const status = await getSyncStatus(currentTenantId);
      notifyListeners({ ...status, isSyncing: false, lastError });
    }
  }
}

/**
 * Démarre le worker pour un tenant donné.
 * Idempotent : si déjà démarré pour le même tenant, ne fait rien.
 */
export function startSyncWorker(tenantId: string): void {
  if (isRunning && currentTenantId === tenantId) return;

  // Si on change de tenant, on arrête d'abord l'ancien
  if (isRunning && currentTenantId !== tenantId) {
    stopSyncWorker();
  }

  currentTenantId = tenantId;
  isRunning = true;

  // Sync initiale (différée pour ne pas bloquer le rendu)
  setTimeout(() => {
    void performSync();
  }, 2000);

  // Polling toutes les 30s
  intervalId = setInterval(() => {
    void performSync();
  }, SYNC_INTERVAL_MS);

  // Écouter les événements online/offline
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  console.info(`[syncWorker] Démarré pour tenant ${tenantId} (intervalle: ${SYNC_INTERVAL_MS / 1000}s)`);
}

/**
 * Arrête le worker.
 */
export function stopSyncWorker(): void {
  if (!isRunning) return;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  }

  isRunning = false;
  currentTenantId = null;
  console.info('[syncWorker] Arrêté');
}

/**
 * Déclenche une sync manuelle (bouton "Synchroniser maintenant" dans l'UI).
 */
export async function triggerManualSync(): Promise<void> {
  if (!currentTenantId) {
    console.warn('[syncWorker] Impossible de sync : aucun tenant configuré');
    return;
  }
  await performSync();
}

/**
 * Retourne le statut courant de la sync.
 */
export async function getWorkerStatus(): Promise<SyncStatus | null> {
  if (!currentTenantId) return null;
  const status = await getSyncStatus(currentTenantId);
  return { ...status, isSyncing, lastError };
}

/**
 * S'abonne aux changements de statut (pour l'UI).
 * Retourne une fonction de désabonnement.
 */
export function subscribeToSyncStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * Retourne le dernier résultat de sync (pour affichage dans l'UI).
 */
export function getLastSyncResult(): typeof lastSyncResult {
  return lastSyncResult;
}

// ============================================================
// HANDLERS D'ÉVÉNEMENTS RÉSEAU
// ============================================================

function handleOnline(): void {
  console.info('[syncWorker] Réseau restauré — sync immédiate');
  void performSync();
}

function handleOffline(): void {
  console.info('[syncWorker] Réseau perdu — sync en pause (mode offline)');
  // Notifier l'UI que le réseau est coupé
  if (currentTenantId) {
    void getSyncStatus(currentTenantId).then((status) => {
      notifyListeners({ ...status, isOnline: false });
    });
  }
}

// ============================================================
// VUE LIFECYCLE (optionnel) — pause sync quand l'onglet est inactif
// ============================================================

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isRunning && currentTenantId) {
      // L'utilisateur revient sur l'onglet → sync immédiate pour rafraîchir les données
      void performSync();
    }
  });
}

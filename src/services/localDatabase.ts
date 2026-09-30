import Dexie, { Table } from 'dexie';
import {
  Patient,
  Appointment,
  ClinicalNote,
  ClinicalAddendum,
  MedicationOrder,
  FollowUpTask,
  SecureConversation,
  SecureMessage,
  AuditEvent,
  OutboxItem,
  BreakGlassEvent,
} from '../types/clinical';

/**
 * Base de données locale IndexedDB (via Dexie) — Offline-First
 *
 * Architecture :
 *  - Chaque table est préfixée par `tenant_id` pour le multi-tenant
 *  - Les données survivent aux refreshs / redémarrages navigateur
 *  - Synchronisation bidirectionnelle avec Supabase via la table `outbox_items`
 *  - L'audit trail est stocké localement pour résister aux coupures réseau
 *
 * Stratégie de sync :
 *  1. Toute mutation (INSERT/UPDATE/DELETE) est écrite en local + ajoutée à l'outbox
 *  2. Un worker en arrière-plan (syncWorker) pousse l'outbox vers Supabase
 *  3. Au démarrage et toutes les 30s, on pull les nouveautés depuis Supabase
 *  4. La `idempotency_key` garantit qu'une opération rejouée ne crée pas de doublon
 */

export interface LocalUser {
  id: string;
  tenantId: string;
  username: string;
  email?: string; // Présent si Google OAuth utilisé
  displayName: string;
  role: string;
  department: string;
  serviceCode: string;
  licenseNumber?: string;
  rppsCode?: string;
  isActive: boolean;
  lastLoginAt?: string;
  // Hash PBKDF2 (100k itérations via Web Crypto) — secure offline auth
  passwordHash: string;
  salt: string;
  // Champs Google OAuth (second facteur optionnel — préserve l'offline-first)
  googleId?: string; // Si lié à un compte Google
  avatarUrl?: string; // URL de l'avatar Google
}

export interface LocalSession {
  id: string;
  userId: string;
  tenantId: string;
  tokenHash: string; // Hash du token de session
  expiresAt: string;
  createdAt: string;
  revokedAt?: string;
  machineCode?: string;
}

export interface LocalLicense {
  id: string;
  keyCode: string;
  tenantId: string;
  machineCode: string;
  status: 'pending' | 'active' | 'revoked' | 'expired';
  activatedAt: string;
  expiresAt: string;
  lastVerifiedAt?: string;
}

class OneDeskDatabase extends Dexie {
  // Tables cliniques
  patients!: Table<Patient & { tenantId: string }, string>;
  appointments!: Table<Appointment & { tenantId: string }, string>;
  clinicalNotes!: Table<ClinicalNote & { tenantId: string }, string>;
  clinicalAddenda!: Table<ClinicalAddendum & { tenantId: string }, string>;
  medicationOrders!: Table<MedicationOrder & { tenantId: string }, string>;
  followUpTasks!: Table<FollowUpTask & { tenantId: string }, string>;
  secureConversations!: Table<SecureConversation & { tenantId: string }, string>;
  secureMessages!: Table<SecureMessage & { tenantId: string }, string>;
  breakGlassEvents!: Table<BreakGlassEvent & { tenantId: string }, string>;

  // Sécurité & audit
  auditEvents!: Table<AuditEvent & { tenantId: string; previousHash?: string; integrityChainSeq?: number }, string>;
  outboxItems!: Table<OutboxItem & { tenantId: string }, string>;

  // Auth & licensing
  localUsers!: Table<LocalUser, string>;
  localSessions!: Table<LocalSession, string>;
  localLicenses!: Table<LocalLicense, string>;

  constructor() {
    super('OneDeskDB');

    // Version 1 : schéma initial
    this.version(1).stores({
      // Index primaire + indexes multi-tenant
      patients: 'id, tenantId, medicalRecordNumber, [tenantId+primaryDoctorId], [tenantId+status]',
      appointments: 'id, tenantId, patientId, practitionerId, [tenantId+practitionerId+startsAt], [tenantId+patientId+startsAt]',
      clinicalNotes: 'id, tenantId, patientId, [tenantId+patientId], [tenantId+status]',
      clinicalAddenda: 'id, tenantId, noteId, [tenantId+noteId]',
      medicationOrders: 'id, tenantId, patientId, [tenantId+patientId+status], [tenantId+prescribedBy]',
      followUpTasks: 'id, tenantId, patientId, assignedTo, [tenantId+assignedTo+status], [tenantId+dueAt]',
      secureConversations: 'id, tenantId, [tenantId+status]',
      secureMessages: 'id, tenantId, conversationId, [tenantId+conversationId+sentAt]',
      breakGlassEvents: 'id, tenantId, userId, patientId, [tenantId+active]',

      // Audit : index sur tenant + seq pour reconstruire la chaîne rapidement
      auditEvents: 'id, tenantId, occurredAt, actorUserId, [tenantId+integrityChainSeq], [tenantId+occurredAt]',
      outboxItems: 'id, tenantId, status, idempotencyKey, [tenantId+status], [status+createdAt]',

      // Auth
      localUsers: 'id, tenantId, username, [tenantId+username], [tenantId+isActive]',
      localSessions: 'id, userId, tenantId, tokenHash, expiresAt, [tenantId+expiresAt]',
      localLicenses: 'id, keyCode, tenantId, machineCode, status, [tenantId+status]',
    });
  }

  /**
   * Vide toutes les tables d'un tenant (sans toucher aux autres tenants).
   * Utilisé lors d'un reset ou changement de tenant.
   */
  async clearTenantData(tenantId: string): Promise<void> {
    await this.transaction(
      'rw',
      [
        this.patients,
        this.appointments,
        this.clinicalNotes,
        this.clinicalAddenda,
        this.medicationOrders,
        this.followUpTasks,
        this.secureConversations,
        this.secureMessages,
        this.breakGlassEvents,
        this.auditEvents,
        this.outboxItems,
      ],
      async () => {
        await Promise.all([
          this.patients.where('tenantId').equals(tenantId).delete(),
          this.appointments.where('tenantId').equals(tenantId).delete(),
          this.clinicalNotes.where('tenantId').equals(tenantId).delete(),
          this.clinicalAddenda.where('tenantId').equals(tenantId).delete(),
          this.medicationOrders.where('tenantId').equals(tenantId).delete(),
          this.followUpTasks.where('tenantId').equals(tenantId).delete(),
          this.secureConversations.where('tenantId').equals(tenantId).delete(),
          this.secureMessages.where('tenantId').equals(tenantId).delete(),
          this.breakGlassEvents.where('tenantId').equals(tenantId).delete(),
          this.auditEvents.where('tenantId').equals(tenantId).delete(),
          this.outboxItems.where('tenantId').equals(tenantId).delete(),
        ]);
      }
    );
  }

  /**
   * Récupère le nombre d'éléments en attente de synchronisation.
   */
  async getPendingOutboxCount(tenantId: string): Promise<number> {
    return this.outboxItems
      .where('[tenantId+status]')
      .equals([tenantId, 'pending'])
      .count();
  }

  /**
   * Récupère les derniers événements d'audit pour reconstruire la chaîne.
   * Triés par seq décroissant — utilisé par cryptoAuditService.getLastEventHash.
   */
  async getLatestAuditEvents(tenantId: string, limit = 1): Promise<(AuditEvent & { tenantId: string; previousHash?: string; integrityChainSeq?: number })[]> {
    return this.auditEvents
      .where('tenantId')
      .equals(tenantId)
      .reverse()
      .sortBy('occurredAt')
      .then((events) => events.slice(0, limit));
  }
}

export const db = new OneDeskDatabase();

/**
 * Initialise la base locale avec un seed de démo si elle est vide.
 * Appelé au démarrage de l'app en mode staging/preview.
 */
export async function seedLocalDatabaseIfEmpty(): Promise<void> {
  const patientCount = await db.patients.count();
  if (patientCount > 0) return;

  // Le seeding réel se fait via le mockData en mode staging
  // En production, la base locale démarre vide et se remplit via sync Supabase
  return;
}

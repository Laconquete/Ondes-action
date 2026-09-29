import { create } from 'zustand';
import { AuditEvent } from '../types/clinical';
import { db } from '../services/localDatabase';
import {
  computeAuditEventHash,
  getLastEventHash,
  generateSecureId,
} from '../services/cryptoAuditService';

/**
 * Store d'Audit Trail Cryptographique
 *
 * Chaque événement est chaîné au précédent par un hash SHA-256 (Web Crypto API).
 * Le hash inclut : payload canonique + hash du précédent + n° de séquence.
 *
 * Garanties :
 *  - Immuable : un UPDATE sur audit_events lève une exception (trigger SQL côté Supabase)
 *  - Vérifiable : la fonction validateAuditChain() détecte toute rupture
 *  - Tenant-isolé : chaque tenant a sa propre chaîne (previousHash = GENESIS au début)
 *  - Local-first : tout est écrit en IndexedDB (Dexie) avant sync Supabase
 */

interface AuditState {
  events: AuditEvent[];
  isLogging: boolean;
  chainValid: boolean | null;
  lastValidationError: string | null;

  log: (
    action: string,
    resourceType: string,
    actor: { id: string; name: string; role: string },
    tenantId: string,
    details: {
      resourceId?: string;
      patientId?: string;
      patientName?: string;
      outcome?: 'allowed' | 'denied' | 'challenged' | 'error';
      reasonText?: string;
    }
  ) => Promise<AuditEvent | null>;

  loadForTenant: (tenantId: string) => Promise<void>;
  validateChain: (tenantId: string) => Promise<boolean>;
  clearErrors: () => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  events: [],
  isLogging: false,
  chainValid: null,
  lastValidationError: null,

  log: async (action, resourceType, actor, tenantId, details) => {
    set({ isLogging: true });
    try {
      // 1. Charger les events existants pour récupérer le last hash
      const existingEvents = get().events.length > 0
        ? get().events
        : await db.auditEvents.where('tenantId').equals(tenantId).toArray();

      const previousHash = getLastEventHash(existingEvents);
      const seq = existingEvents.length + 1;
      const occurredAt = new Date().toISOString();
      const eventId = generateSecureId('aud');

      // 2. Calculer le hash cryptographique chaîné
      const eventHash = await computeAuditEventHash({
        occurredAt,
        actorUserId: actor.id,
        action,
        resourceType,
        resourceId: details.resourceId,
        patientId: details.patientId,
        patientName: details.patientName,
        outcome: details.outcome || 'allowed',
        reasonText: details.reasonText,
        previousHash,
        tenantId,
        seq,
      });

      // 3. Construire l'événement complet
      const newEvent: AuditEvent & { tenantId: string; previousHash: string; integrityChainSeq: number } = {
        id: eventId,
        occurredAt,
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action,
        resourceType,
        resourceId: details.resourceId,
        patientId: details.patientId,
        patientName: details.patientName,
        outcome: details.outcome || 'allowed',
        reasonText: details.reasonText,
        eventHash,
        previousHash,
        tenantId,
        integrityChainSeq: seq,
      } as AuditEvent & { tenantId: string; previousHash: string; integrityChainSeq: number };

      // 4. Persister en local (IndexedDB)
      await db.auditEvents.add(newEvent);

      // 5. Mettre à jour le state
      set((state) => ({ events: [newEvent as AuditEvent, ...state.events], isLogging: false }));

      // 6. Ajouter à l'outbox pour sync Supabase
      await db.outboxItems.add({
        id: generateSecureId('out'),
        tenantId,
        aggregateType: 'audit_event',
        aggregateId: eventId,
        operationType: 'INSERT',
        payload: newEvent as unknown as Record<string, unknown>,
        baseVersion: 1,
        idempotencyKey: generateSecureId('idemp'),
        createdAt: occurredAt,
        status: 'applied', // Sera mis à 'pending' par le syncWorker si offline
      });

      return newEvent as AuditEvent;
    } catch (err) {
      console.error('[auditStore] Failed to log event:', err);
      set({ isLogging: false });
      return null;
    }
  },

  loadForTenant: async (tenantId) => {
    const events = await db.auditEvents
      .where('tenantId')
      .equals(tenantId)
      .reverse()
      .sortBy('occurredAt');
    set({ events: events.reverse() as AuditEvent[] });
  },

  validateChain: async (tenantId) => {
    // Lazy import pour éviter la dépendance circulaire
    const { validateAuditChain } = await import('../services/cryptoAuditService');
    const events = await db.auditEvents.where('tenantId').equals(tenantId).toArray();
    const result = await validateAuditChain(events as AuditEvent[], tenantId);
    set({
      chainValid: result.isValid,
      lastValidationError: result.isValid ? null : result.reason,
    });
    return result.isValid;
  },

  clearErrors: () => set({ lastValidationError: null }),
}));

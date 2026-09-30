import { useCallback } from 'react';
import { AuditEvent, AppUser } from '../types/clinical';
import { useAuditStore } from '../stores/auditStore';

const DEFAULT_TENANT_ID = 'demo-tenant-001';

/**
 * useAuditLog — Double journalisation (legacy UI + crypto SHA-256 chaîné).
 *
 * Extrait de App.tsx pour isoler la logique d'audit.
 *
 * Architecture :
 *  1. Ancien système (state React + hash DJB2) → alimente l'UI AuditTrailView existante
 *  2. Nouveau système (auditStore.log + SHA-256 chaîné via Web Crypto) → journal légal HDS
 *
 * Une fois la nouvelle UI branchée, l'ancien système pourra être supprimé.
 */

interface UseAuditLogOptions {
  currentUser: AppUser;
  setAuditEvents: React.Dispatch<React.SetStateAction<AuditEvent[]>>;
}

interface AuditLogFn {
  (
    action: string,
    resourceType: string,
    details: {
      resourceId?: string;
      patientId?: string;
      patientName?: string;
      outcome?: 'allowed' | 'denied' | 'challenged';
      reasonText?: string;
    }
  ): void;
}

export function useAuditLog({ currentUser, setAuditEvents }: UseAuditLogOptions): AuditLogFn {
  const auditStoreLog = useAuditStore((s) => s.log);

  return useCallback(
    (action, resourceType, details = {}) => {
      const now = new Date().toISOString();

      // --- ANCIEN SYSTÈME (préserve l'UI existante — à déprécier après migration) ---
      const rawString = `${now}:${currentUser.id}:${action}:${details.resourceId || ''}:${details.patientId || ''}`;
      let hash = 0;
      for (let i = 0; i < rawString.length; i++) {
        hash = (hash << 5) - hash + rawString.charCodeAt(i);
        hash |= 0;
      }
      const legacyEventHash = `sha256_${Math.abs(hash).toString(16).padStart(12, '0')}`;

      const newEvent: AuditEvent = {
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        occurredAt: now,
        actorUserId: currentUser.id,
        actorName: currentUser.displayName,
        actorRole: currentUser.role,
        action,
        resourceType,
        resourceId: details.resourceId,
        patientId: details.patientId,
        patientName: details.patientName,
        outcome: details.outcome || 'allowed',
        reasonText: details.reasonText,
        eventHash: legacyEventHash,
      };
      setAuditEvents((prev) => [newEvent, ...prev]);

      // --- NOUVEAU SYSTÈME (chaîne SHA-256 cryptographique, persistant, HDS-conforme) ---
      void auditStoreLog(
        action,
        resourceType,
        { id: currentUser.id, name: currentUser.displayName, role: currentUser.role },
        DEFAULT_TENANT_ID,
        {
          resourceId: details.resourceId,
          patientId: details.patientId,
          patientName: details.patientName,
          outcome: details.outcome,
          reasonText: details.reasonText,
        }
      ).catch((err) => {
        console.error('[useAuditLog] Failed to persist cryptographically chained event:', err);
      });
    },
    [currentUser, auditStoreLog, setAuditEvents]
  );
}

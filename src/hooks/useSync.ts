import { useState, useEffect, useCallback } from 'react';
import {
  getWorkerStatus,
  triggerManualSync,
  subscribeToSyncStatus,
  startSyncWorker,
} from '../services/syncWorker';
import type { SyncStatus } from '../services/syncEngine';

/**
 * Hook React pour interagir avec le syncWorker.
 *
 * Usage dans un composant :
 * ```tsx
 * const { status, syncNow, isSyncing } = useSync(tenantId);
 * ```
 *
 * Retourne :
 *  - status : l'état courant de la sync (pendingCount, lastSyncAt, isOnline, etc.)
 *  - syncNow : fonction pour déclencher une sync manuelle
 *  - isSyncing : raccourci pour status.isSyncing
 *
 * Le hook démarre automatiquement le syncWorker au montage si tenantId est fourni,
 * et l'arrête au démontage.
 */
export function useSync(tenantId: string | null): {
  status: SyncStatus | null;
  syncNow: () => Promise<void>;
  isSyncing: boolean;
  isConfigured: boolean;
} {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  // Démarrer/arrêter le worker quand le tenant change
  useEffect(() => {
    if (!tenantId) {
      setStatus(null);
      return;
    }

    startSyncWorker(tenantId);

    // Charger le statut initial
    void getWorkerStatus().then((s) => {
      if (s) setStatus(s);
    });

    // S'abonner aux mises à jour
    const unsubscribe = subscribeToSyncStatus((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, [tenantId]);

  // Mettre à jour le statut toutes les 5 secondes (en plus des notifications)
  useEffect(() => {
    if (!tenantId) return;
    const interval = setInterval(() => {
      void getWorkerStatus().then((s) => {
        if (s) setStatus(s);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const syncNow = useCallback(async () => {
    await triggerManualSync();
    const s = await getWorkerStatus();
    if (s) setStatus(s);
  }, []);

  return {
    status,
    syncNow,
    isSyncing: status?.isSyncing ?? false,
    isConfigured: status?.isConfigured ?? false,
  };
}

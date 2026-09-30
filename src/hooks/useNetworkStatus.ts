import { useState, useEffect, useCallback } from 'react';
import { OutboxItem } from '../types/clinical';

/**
 * useNetworkStatus — Gère l'état réseau + l'outbox local.
 *
 * Extrait de App.tsx pour isoler la logique offline/online.
 * - isOnline : reflète navigator.onLine + écoute les événements online/offline
 * - outbox : liste locale des opérations en attente de sync
 * - lastSyncTime : timestamp de la dernière sync
 */

interface NetworkStatusState {
  isOnline: boolean;
  outbox: OutboxItem[];
  lastSyncTime: string;
  setOnline: (online: boolean) => void;
  setOutbox: React.Dispatch<React.SetStateAction<OutboxItem[]>>;
  setLastSyncTime: (time: string) => void;
  addOutboxItem: (item: OutboxItem) => void;
}

export function useNetworkStatus(initialOnline = true): NetworkStatusState {
  const [isOnline, setIsOnline] = useState<boolean>(initialOnline);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toISOString());

  // Écouter les changements de connectivité réseau
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Synchroniser avec l'état réel du navigateur au montage
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const setOnline = useCallback((online: boolean) => setIsOnline(online), []);
  const addOutboxItem = useCallback((item: OutboxItem) => {
    setOutbox((prev) => [item, ...prev]);
  }, []);

  return {
    isOnline,
    outbox,
    lastSyncTime,
    setOnline,
    setOutbox,
    setLastSyncTime,
    addOutboxItem,
  };
}

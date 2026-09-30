import { useCallback } from 'react';
import { OutboxItem } from '../types/clinical';

/**
 * useOutbox — Gère la queue des opérations en attente de sync Supabase.
 *
 * Extrait de App.tsx pour isoler la logique offline (outbox pattern).
 * Chaque mutation locale génère un outbox item avec idempotencyKey,
 * qui sera poussé vers Supabase par le syncWorker.
 */

interface UseOutboxOptions {
  isOnline: boolean;
  setOutbox: React.Dispatch<React.SetStateAction<OutboxItem[]>>;
}

interface QueueOutboxFn {
  (
    aggregateType: string,
    aggregateId: string,
    operationType: string,
    payload: Record<string, unknown>
  ): void;
}

export function useOutbox({ isOnline, setOutbox }: UseOutboxOptions): QueueOutboxFn {
  return useCallback(
    (aggregateType, aggregateId, operationType, payload) => {
      const item: OutboxItem = {
        id: `out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        aggregateType,
        aggregateId,
        operationType,
        payload,
        baseVersion: 1,
        idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
        status: isOnline ? 'applied' : 'pending',
      };
      setOutbox((prev) => [item, ...prev]);
    },
    [isOnline, setOutbox]
  );
}

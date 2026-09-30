import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from './localDatabase';
import { resetSupabaseClient } from './supabaseClient';
import {
  pushOutbox,
  pullAllTables,
  fullSync,
  getSyncStatus,
  cleanupAppliedOutbox,
  retryFailedItems,
} from './syncEngine';

// ============================================================
// MOCK SUPABASE CLIENT
// ============================================================

// On mocke le module supabaseClient pour contrôler le comportement
vi.mock('./supabaseClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./supabaseClient')>();
  return {
    ...actual,
    getSupabase: vi.fn(),
    isSupabaseConfigured: vi.fn(() => true),
    resetSupabaseClient: actual.resetSupabaseClient,
  };
});

import { getSupabase } from './supabaseClient';

// Type du mock Supabase — on simule l'API chainable
interface MockQueryBuilder {
  insert: (payload: Record<string, unknown>) => Promise<{ error: unknown }>;
  upsert: (payload: Record<string, unknown>, opts?: unknown) => Promise<{ error: unknown }>;
  delete: () => { eq: (col: string, val: unknown) => Promise<{ error: unknown }> };
  select: (cols: string) => {
    eq: (col: string, val: unknown) => {
      gt: (col: string, val: unknown) => {
        order: (col: string, opts: unknown) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
      order: (col: string, opts: unknown) => {
        limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
      };
      limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
      maybeSingle: () => Promise<{ error: unknown }>;
    };
  };
}

function createMockSupabase(options: {
  insertError?: { code: string; message: string } | null;
  upsertError?: { code: string; message: string } | null;
  selectData?: Record<string, unknown[]>;
  selectError?: { code: string; message: string } | null;
} = {}): MockQueryBuilder {
  return {
    insert: async (payload: Record<string, unknown>) => {
      if (options.insertError) return { error: options.insertError };
      // Simuler le succès
      return { error: null };
    },
    upsert: async (payload: Record<string, unknown>) => {
      if (options.upsertError) return { error: options.upsertError };
      return { error: null };
    },
    delete: () => ({
      eq: async () => ({ error: null }),
    }),
    select: (cols: string) => ({
      eq: (col: string, val: unknown) => {
        const chain = {
          gt: (gtCol: string, gtVal: unknown) => ({
            order: (orderCol: string, orderOpts: unknown) => ({
              limit: async (n: number) => {
                if (options.selectError) return { data: null, error: options.selectError };
                const tableName = 'patients'; // simplifié pour les tests
                const data = options.selectData?.[tableName] || [];
                return { data: data.slice(0, n), error: null };
              },
            }),
          }),
          order: (orderCol: string, orderOpts: unknown) => ({
            limit: async (n: number) => {
              if (options.selectError) return { data: null, error: options.selectError };
              const data = options.selectData?.patients || [];
              return { data: data.slice(0, n), error: null };
            },
          }),
          limit: async (n: number) => {
            if (options.selectError) return { data: null, error: options.selectError };
            return { data: options.selectData?.patients || [], error: null };
          },
          maybeSingle: async () => ({ error: null }),
        };
        return chain;
      },
    }),
  };
}

// Helper : créé un mock Supabase avec l'API chainable complète
function mockSupabaseFrom(tableName: string, mockBuilder: MockQueryBuilder) {
  return {
    from: vi.fn((name: string) => {
      if (name === tableName) return mockBuilder;
      // Pour les autres tables, retourner un mock vide
      return createMockSupabase({ selectData: {} });
    }),
  };
}

const TENANT_ID = 'test-tenant-001';

beforeEach(async () => {
  // Reset tous les mocks
  vi.clearAllMocks();
  resetSupabaseClient();

  // Vider la base Dexie de test
  await db.delete();
  await db.open();

  // Vider le localStorage des clés de sync
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith('onedesk:sync:')) {
      localStorage.removeItem(key);
    }
  }
});

describe('syncEngine', () => {
  describe('pushOutbox', () => {
    it('returns 0 pushed when Supabase is not configured', async () => {
      vi.mocked(getSupabase).mockReturnValue(null);
      const result = await pushOutbox(TENANT_ID);
      expect(result.pushed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toContain('Supabase non configuré');
    });

    it('pushes pending items and marks them as applied', async () => {
      // Setup : mock Supabase qui accepte tout
      const mockClient = {
        from: vi.fn(() => createMockSupabase()),
      };
      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      // Seed : un outbox item pending
      await db.outboxItems.add({
        id: 'out_1',
        tenantId: TENANT_ID,
        aggregateType: 'patient',
        aggregateId: 'pat_1',
        operationType: 'INSERT',
        payload: { id: 'pat_1', family_name: 'Test' },
        baseVersion: 1,
        idempotencyKey: 'idemp_1',
        createdAt: new Date().toISOString(),
        status: 'pending',
      });

      const result = await pushOutbox(TENANT_ID);
      expect(result.pushed).toBe(1);
      expect(result.failed).toBe(0);

      // Vérifier que l'item est marqué 'applied'
      const updated = await db.outboxItems.get('out_1');
      expect(updated?.status).toBe('applied');
      expect(updated?.appliedAt).toBeDefined();
    });

    it('treats 23505 (unique_violation) as idempotent success', async () => {
      // Mock qui simule un doublon (item déjà inséré)
      const mockBuilder = createMockSupabase({
        insertError: { code: '23505', message: 'duplicate key' },
      });
      const mockClient = { from: vi.fn(() => mockBuilder) };
      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      await db.outboxItems.add({
        id: 'out_dup',
        tenantId: TENANT_ID,
        aggregateType: 'patient',
        aggregateId: 'pat_dup',
        operationType: 'INSERT',
        payload: { id: 'pat_dup' },
        baseVersion: 1,
        idempotencyKey: 'idemp_dup',
        createdAt: new Date().toISOString(),
        status: 'pending',
      });

      const result = await pushOutbox(TENANT_ID);
      expect(result.pushed).toBe(1); // Compté comme succès (idempotent)
      expect(result.failed).toBe(0);

      const updated = await db.outboxItems.get('out_dup');
      expect(updated?.status).toBe('applied'); // Marqué comme appliqué
    });

    it('marks failed items with error message', async () => {
      const mockBuilder = createMockSupabase({
        insertError: { code: 'P0001', message: 'Permission denied' },
      });
      const mockClient = { from: vi.fn(() => mockBuilder) };
      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      await db.outboxItems.add({
        id: 'out_fail',
        tenantId: TENANT_ID,
        aggregateType: 'patient',
        aggregateId: 'pat_fail',
        operationType: 'INSERT',
        payload: { id: 'pat_fail' },
        baseVersion: 1,
        idempotencyKey: 'idemp_fail',
        createdAt: new Date().toISOString(),
        status: 'pending',
      });

      const result = await pushOutbox(TENANT_ID);
      expect(result.pushed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);

      const updated = await db.outboxItems.get('out_fail');
      expect(updated?.status).toBe('failed');
      expect(updated?.errorMessage).toContain('Permission denied');
    });

    it('processes items in FIFO order (by createdAt)', async () => {
      const callOrder: string[] = [];
      const mockBuilder = {
        insert: async (payload: Record<string, unknown>) => {
          callOrder.push(payload.id as string);
          return { error: null };
        },
        upsert: async () => ({ error: null }),
        delete: () => ({ eq: async () => ({ error: null }) }),
        select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }), maybeSingle: async () => ({ error: null }), order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
      };
      const mockClient = { from: vi.fn(() => mockBuilder) };
      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      // Seed 3 items with different timestamps
      const baseTime = Date.now();
      await db.outboxItems.add({
        id: 'out_c',
        tenantId: TENANT_ID,
        aggregateType: 'patient',
        aggregateId: 'pat_c',
        operationType: 'INSERT',
        payload: { id: 'pat_c' },
        baseVersion: 1,
        idempotencyKey: 'idemp_c',
        createdAt: new Date(baseTime + 2000).toISOString(),
        status: 'pending',
      });
      await db.outboxItems.add({
        id: 'out_a',
        tenantId: TENANT_ID,
        aggregateType: 'patient',
        aggregateId: 'pat_a',
        operationType: 'INSERT',
        payload: { id: 'pat_a' },
        baseVersion: 1,
        idempotencyKey: 'idemp_a',
        createdAt: new Date(baseTime).toISOString(),
        status: 'pending',
      });
      await db.outboxItems.add({
        id: 'out_b',
        tenantId: TENANT_ID,
        aggregateType: 'patient',
        aggregateId: 'pat_b',
        operationType: 'INSERT',
        payload: { id: 'pat_b' },
        baseVersion: 1,
        idempotencyKey: 'idemp_b',
        createdAt: new Date(baseTime + 1000).toISOString(),
        status: 'pending',
      });

      await pushOutbox(TENANT_ID);
      // Doit être traité dans l'ordre : a, b, c (trié par createdAt)
      expect(callOrder).toEqual(['pat_a', 'pat_b', 'pat_c']);
    });
  });

  describe('pullAllTables', () => {
    it('returns 0 pulled when Supabase is not configured', async () => {
      vi.mocked(getSupabase).mockReturnValue(null);
      const result = await pullAllTables(TENANT_ID);
      expect(result.pulled).toBe(0);
      expect(result.errors).toContain('Supabase non configuré');
    });

    it('upserts pulled rows into local Dexie', async () => {
      // Mock qui retourne 2 patients
      const mockBuilder = createMockSupabase({
        selectData: {
          patients: [
            { id: 'pat_1', tenant_id: TENANT_ID, family_name: 'Test1', updated_at: '2026-09-30T10:00:00Z' },
            { id: 'pat_2', tenant_id: TENANT_ID, family_name: 'Test2', updated_at: '2026-09-30T11:00:00Z' },
          ],
        },
      });
      const mockClient = { from: vi.fn(() => mockBuilder) };
      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const result = await pullAllTables(TENANT_ID);
      // Au moins 2 lignes tirées (depuis la table patients)
      expect(result.pulled).toBeGreaterThanOrEqual(2);

      // Vérifier que les patients sont en local
      const localPat1 = await db.patients.get('pat_1');
      expect(localPat1).toBeDefined();
    });

    it('stores lastSyncTime after pull', async () => {
      const mockBuilder = createMockSupabase({
        selectData: {
          patients: [
            { id: 'pat_1', tenant_id: TENANT_ID, updated_at: '2026-09-30T12:00:00Z' },
          ],
        },
      });
      const mockClient = { from: vi.fn(() => mockBuilder) };
      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      await pullAllTables(TENANT_ID);

      const lastSync = localStorage.getItem(`onedesk:sync:${TENANT_ID}:patients:lastSyncAt`);
      expect(lastSync).toBe('2026-09-30T12:00:00Z');
    });
  });

  describe('fullSync', () => {
    it('pushes then pulls in a single operation', async () => {
      // Seed un outbox item
      await db.outboxItems.add({
        id: 'out_1',
        tenantId: TENANT_ID,
        aggregateType: 'patient',
        aggregateId: 'pat_1',
        operationType: 'INSERT',
        payload: { id: 'pat_1', family_name: 'Test' },
        baseVersion: 1,
        idempotencyKey: 'idemp_1',
        createdAt: new Date().toISOString(),
        status: 'pending',
      });

      const mockBuilder = createMockSupabase({
        selectData: {
          patients: [
            { id: 'pat_remote', tenant_id: TENANT_ID, family_name: 'Remote', updated_at: '2026-09-30T15:00:00Z' },
          ],
        },
      });
      const mockClient = { from: vi.fn(() => mockBuilder) };
      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const result = await fullSync(TENANT_ID);
      expect(result.pushed).toBe(1);
      expect(result.pulled).toBeGreaterThanOrEqual(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getSyncStatus', () => {
    it('returns correct status when Supabase not configured', async () => {
      vi.mocked(getSupabase).mockReturnValue(null);
      const status = await getSyncStatus(TENANT_ID);
      expect(status.isConfigured).toBe(false);
      expect(status.pendingCount).toBe(0);
    });

    it('counts pending and failed items', async () => {
      const mockClient = { from: vi.fn(() => createMockSupabase()) };
      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      await db.outboxItems.bulkAdd([
        { id: 'p1', tenantId: TENANT_ID, aggregateType: 'patient', aggregateId: 'a', operationType: 'INSERT', payload: {}, baseVersion: 1, idempotencyKey: 'k1', createdAt: new Date().toISOString(), status: 'pending' },
        { id: 'p2', tenantId: TENANT_ID, aggregateType: 'patient', aggregateId: 'b', operationType: 'INSERT', payload: {}, baseVersion: 1, idempotencyKey: 'k2', createdAt: new Date().toISOString(), status: 'pending' },
        { id: 'f1', tenantId: TENANT_ID, aggregateType: 'patient', aggregateId: 'c', operationType: 'INSERT', payload: {}, baseVersion: 1, idempotencyKey: 'k3', createdAt: new Date().toISOString(), status: 'failed', errorMessage: 'test error' },
      ]);

      const status = await getSyncStatus(TENANT_ID);
      expect(status.isConfigured).toBe(true);
      expect(status.pendingCount).toBe(2);
      expect(status.failedCount).toBe(1);
    });
  });

  describe('cleanupAppliedOutbox', () => {
    it('keeps only the 100 most recent applied items', async () => {
      const mockClient = { from: vi.fn(() => createMockSupabase()) };
      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      // Seed 105 applied items
      const items = [];
      for (let i = 0; i < 105; i++) {
        items.push({
          id: `applied_${i}`,
          tenantId: TENANT_ID,
          aggregateType: 'patient',
          aggregateId: `pat_${i}`,
          operationType: 'INSERT',
          payload: {},
          baseVersion: 1,
          idempotencyKey: `k_${i}`,
          createdAt: new Date(Date.now() + i * 1000).toISOString(),
          status: 'applied' as const,
          appliedAt: new Date(Date.now() + i * 2000).toISOString(),
        });
      }
      await db.outboxItems.bulkAdd(items);

      const deleted = await cleanupAppliedOutbox(TENANT_ID);
      expect(deleted).toBe(5); // 105 - 100 = 5 supprimés

      const remaining = await db.outboxItems.where('status').equals('applied').count();
      expect(remaining).toBe(100);
    });

    it('does nothing when fewer than 100 applied items', async () => {
      const mockClient = { from: vi.fn(() => createMockSupabase()) };
      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      await db.outboxItems.add({
        id: 'applied_1',
        tenantId: TENANT_ID,
        aggregateType: 'patient',
        aggregateId: 'pat_1',
        operationType: 'INSERT',
        payload: {},
        baseVersion: 1,
        idempotencyKey: 'k_1',
        createdAt: new Date().toISOString(),
        status: 'applied',
        appliedAt: new Date().toISOString(),
      });

      const deleted = await cleanupAppliedOutbox(TENANT_ID);
      expect(deleted).toBe(0);
    });
  });

  describe('retryFailedItems', () => {
    it('resets failed items to pending', async () => {
      const mockClient = { from: vi.fn(() => createMockSupabase()) };
      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      await db.outboxItems.bulkAdd([
        { id: 'f1', tenantId: TENANT_ID, aggregateType: 'patient', aggregateId: 'a', operationType: 'INSERT', payload: {}, baseVersion: 1, idempotencyKey: 'k1', createdAt: new Date().toISOString(), status: 'failed', errorMessage: 'error 1' },
        { id: 'f2', tenantId: TENANT_ID, aggregateType: 'patient', aggregateId: 'b', operationType: 'INSERT', payload: {}, baseVersion: 1, idempotencyKey: 'k2', createdAt: new Date().toISOString(), status: 'failed', errorMessage: 'error 2' },
        { id: 'p1', tenantId: TENANT_ID, aggregateType: 'patient', aggregateId: 'c', operationType: 'INSERT', payload: {}, baseVersion: 1, idempotencyKey: 'k3', createdAt: new Date().toISOString(), status: 'pending' },
      ]);

      const count = await retryFailedItems(TENANT_ID);
      expect(count).toBe(2);

      // Vérifier que les items failed sont maintenant pending
      const f1 = await db.outboxItems.get('f1');
      expect(f1?.status).toBe('pending');
      expect(f1?.errorMessage).toBeUndefined();
    });

    it('returns 0 when no failed items', async () => {
      const mockClient = { from: vi.fn(() => createMockSupabase()) };
      vi.mocked(getSupabase).mockReturnValue(mockClient as any);
      const count = await retryFailedItems(TENANT_ID);
      expect(count).toBe(0);
    });
  });
});

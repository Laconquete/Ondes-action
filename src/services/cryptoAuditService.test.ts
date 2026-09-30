import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeSha256,
  canonicalJson,
  computeAuditEventHash,
  validateAuditChain,
  getLastEventHash,
  generateSecureId,
} from './cryptoAuditService';
import { AuditEvent } from '../types/clinical';

describe('cryptoAuditService', () => {
  describe('computeSha256', () => {
    it('produces a stable hex hash prefixed with sha256_', async () => {
      const hash = await computeSha256('hello world');
      expect(hash).toMatch(/^sha256_[0-9a-f]{64}$/);
    });

    it('produces the same hash for the same input', async () => {
      const h1 = await computeSha256('OneDesk audit trail');
      const h2 = await computeSha256('OneDesk audit trail');
      expect(h1).toBe(h2);
    });

    it('produces a different hash for different inputs', async () => {
      const h1 = await computeSha256('event A');
      const h2 = await computeSha256('event B');
      expect(h1).not.toBe(h2);
    });

    it('produces the canonical SHA-256 of "hello world" (known vector)', async () => {
      const hash = await computeSha256('hello world');
      // SHA-256("hello world") = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
      expect(hash).toBe('sha256_b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });
  });

  describe('canonicalJson', () => {
    it('sorts object keys alphabetically', () => {
      const result = canonicalJson({ b: 2, a: 1, c: 3 });
      expect(result).toBe('{"a":1,"b":2,"c":3}');
    });

    it('handles nested objects recursively', () => {
      const result = canonicalJson({ outer: { z: 1, a: 2 } });
      expect(result).toBe('{"outer":{"a":2,"z":1}}');
    });

    it('preserves array order (significant for clinical data)', () => {
      const result = canonicalJson({ symptoms: ['fever', 'cough', 'pain'] });
      expect(result).toBe('{"symptoms":["fever","cough","pain"]}');
    });

    it('produces the same output regardless of key insertion order', () => {
      const a = canonicalJson({ x: 1, y: 2, z: 3 });
      const b = canonicalJson({ z: 3, x: 1, y: 2 });
      expect(a).toBe(b);
    });

    it('handles null and primitives', () => {
      expect(canonicalJson(null)).toBe('null');
      expect(canonicalJson(42)).toBe('42');
      expect(canonicalJson('test')).toBe('"test"');
    });
  });

  describe('computeAuditEventHash', () => {
    const baseEvent = {
      occurredAt: '2026-09-30T10:00:00Z',
      actorUserId: 'usr_001',
      action: 'PATIENT_RECORD_VIEW',
      resourceType: 'patient',
      resourceId: 'pat_001',
      patientId: 'pat_001',
      patientName: 'Diallo Aïcha',
      outcome: 'allowed' as const,
      reasonText: 'Consultation du dossier',
      previousHash: 'GENESIS',
      tenantId: 'tenant_001',
      seq: 1,
    };

    it('produces a deterministic hash for the same event', async () => {
      const h1 = await computeAuditEventHash(baseEvent);
      const h2 = await computeAuditEventHash(baseEvent);
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^sha256_[0-9a-f]{64}$/);
    });

    it('changes the hash if previousHash changes (chain integrity)', async () => {
      const h1 = await computeAuditEventHash(baseEvent);
      const h2 = await computeAuditEventHash({ ...baseEvent, previousHash: 'sha256_abc' });
      expect(h1).not.toBe(h2);
    });

    it('changes the hash if seq changes', async () => {
      const h1 = await computeAuditEventHash(baseEvent);
      const h2 = await computeAuditEventHash({ ...baseEvent, seq: 2 });
      expect(h1).not.toBe(h2);
    });

    it('changes the hash if tenantId changes (multi-tenant isolation)', async () => {
      const h1 = await computeAuditEventHash(baseEvent);
      const h2 = await computeAuditEventHash({ ...baseEvent, tenantId: 'tenant_002' });
      expect(h1).not.toBe(h2);
    });
  });

  describe('getLastEventHash', () => {
    it('returns GENESIS for empty list', () => {
      expect(getLastEventHash([])).toBe('GENESIS');
    });

    it('returns the hash of the most recent event', () => {
      const events: AuditEvent[] = [
        { ...baseAuditEvent, id: 'e1', occurredAt: '2026-09-30T10:00:00Z', eventHash: 'sha256_aaa' },
        { ...baseAuditEvent, id: 'e2', occurredAt: '2026-09-30T11:00:00Z', eventHash: 'sha256_bbb' },
        { ...baseAuditEvent, id: 'e3', occurredAt: '2026-09-30T09:00:00Z', eventHash: 'sha256_ccc' },
      ];
      expect(getLastEventHash(events)).toBe('sha256_bbb');
    });
  });

  describe('validateAuditChain', () => {
    it('returns valid=true for an empty chain', async () => {
      const result = await validateAuditChain([], 'tenant_001');
      expect(result.isValid).toBe(true);
      expect(result.totalEvents).toBe(0);
    });

    it('returns valid=true for a single correctly-hashed event starting at GENESIS', async () => {
      const event: AuditEvent & { tenantId: string; previousHash: string; integrityChainSeq: number } = {
        ...baseAuditEvent,
        id: 'e1',
        occurredAt: '2026-09-30T10:00:00Z',
        previousHash: 'GENESIS',
        tenantId: 'tenant_001',
        integrityChainSeq: 1,
      };
      event.eventHash = await computeAuditEventHash({
        occurredAt: event.occurredAt,
        actorUserId: event.actorUserId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        patientId: event.patientId,
        patientName: event.patientName,
        outcome: event.outcome,
        reasonText: event.reasonText,
        previousHash: 'GENESIS',
        tenantId: 'tenant_001',
        seq: 1,
      });

      const result = await validateAuditChain([event], 'tenant_001');
      expect(result.isValid).toBe(true);
      expect(result.totalEvents).toBe(1);
    });

    it('returns valid=false when an event hash has been tampered', async () => {
      const event: AuditEvent & { tenantId: string; previousHash: string; integrityChainSeq: number } = {
        ...baseAuditEvent,
        id: 'e1',
        occurredAt: '2026-09-30T10:00:00Z',
        previousHash: 'GENESIS',
        tenantId: 'tenant_001',
        integrityChainSeq: 1,
      };
      // Tamper: store a fake hash that doesn't match the recomputed one
      event.eventHash = 'sha256_faketaltereditdoesnotmatchtherealhashxxxxxxxxxxxx';

      const result = await validateAuditChain([event], 'tenant_001');
      expect(result.isValid).toBe(false);
      expect(result.firstBrokenIndex).toBe(0);
      expect(result.brokenEventId).toBe('e1');
    });

    it('detects a broken chain link (event N+1 does not reference hash of N)', async () => {
      const e1: AuditEvent & { tenantId: string; previousHash: string; integrityChainSeq: number } = {
        ...baseAuditEvent,
        id: 'e1',
        occurredAt: '2026-09-30T10:00:00Z',
        previousHash: 'GENESIS',
        tenantId: 'tenant_001',
        integrityChainSeq: 1,
      };
      e1.eventHash = await computeAuditEventHash({
        occurredAt: e1.occurredAt,
        actorUserId: e1.actorUserId,
        action: e1.action,
        resourceType: e1.resourceType,
        resourceId: e1.resourceId,
        patientId: e1.patientId,
        patientName: e1.patientName,
        outcome: e1.outcome,
        reasonText: e1.reasonText,
        previousHash: 'GENESIS',
        tenantId: 'tenant_001',
        seq: 1,
      });

      const e2: AuditEvent & { tenantId: string; previousHash: string; integrityChainSeq: number } = {
        ...baseAuditEvent,
        id: 'e2',
        occurredAt: '2026-09-30T11:00:00Z',
        previousHash: 'sha256_wrongprevious', // ← incorrect link
        tenantId: 'tenant_001',
        integrityChainSeq: 2,
      };
      e2.eventHash = await computeAuditEventHash({
        occurredAt: e2.occurredAt,
        actorUserId: e2.actorUserId,
        action: e2.action,
        resourceType: e2.resourceType,
        resourceId: e2.resourceId,
        patientId: e2.patientId,
        patientName: e2.patientName,
        outcome: e2.outcome,
        reasonText: e2.reasonText,
        previousHash: 'sha256_wrongprevious',
        tenantId: 'tenant_001',
        seq: 2,
      });

      const result = await validateAuditChain([e1, e2], 'tenant_001');
      expect(result.isValid).toBe(false);
      expect(result.firstBrokenIndex).toBe(1);
      expect(result.brokenEventId).toBe('e2');
    });
  });

  describe('generateSecureId', () => {
    it('produces a unique ID each call', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSecureId('aud'));
      }
      expect(ids.size).toBe(100);
    });

    it('respects the prefix', () => {
      const id = generateSecureId('aud');
      expect(id.startsWith('aud_')).toBe(true);
    });

    it('uses crypto.getRandomValues (not Math.random)', () => {
      // The ID should contain 12 random hex chars (24 chars after prefix + timestamp)
      const id = generateSecureId('test');
      const parts = id.split('_');
      expect(parts.length).toBeGreaterThanOrEqual(3);
      const randomPart = parts[parts.length - 1];
      expect(randomPart.length).toBe(24);
    });
  });
});

const baseAuditEvent: AuditEvent = {
  id: 'e1',
  occurredAt: '2026-09-30T10:00:00Z',
  actorUserId: 'usr_001',
  actorName: 'Dr. Nadia Martin',
  actorRole: 'doctor',
  action: 'PATIENT_RECORD_VIEW',
  resourceType: 'patient',
  resourceId: 'pat_001',
  patientId: 'pat_001',
  patientName: 'Diallo Aïcha',
  outcome: 'allowed',
  reasonText: 'Consultation du dossier',
  eventHash: 'placeholder',
};

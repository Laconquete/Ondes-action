import { AuditEvent } from '../types/clinical';

/**
 * Service d'Audit Trail Cryptographique (HDS-conforme)
 *
 * Architecture :
 *  - Chaque événement possède un `event_hash` = SHA-256(previous_hash || canonical_json(event))
 *  - Le `previous_hash` est le hash du dernier événement du même tenant
 *  - L'immuabilité est garantie car recalculer un hash exige de recalculer toute la chaîne
 *  - En cas de rupture (hash mismatch), on détecte la falsification immédiatement
 *
 * Conformité : HDS (Hébergeur de Données de Santé), RGPD art. 30 (registre des traitements),
 * HEGP / ANSSI recommandations sur les journaux d'événements critiques.
 */

const encoder = new TextEncoder();

/**
 * Calcule un SHA-256 via Web Crypto API (synchrone impossible, on async/await)
 * @param payload La chaîne à hasher
 * @returns Le hash hexadécimal préfixé `sha256_`
 */
export async function computeSha256(payload: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  const bytes = new Uint8Array(buffer);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256_${hex}`;
}

/**
 * Sérialisation canonique JSON pour garantir la reproductibilité du hash.
 * - Trie les clés (alphabétique récursif)
 * - Pas d'espaces
 * - Stable sur les tableaux (ordre préservé)
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalJson).join(',')}]`;
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJson((obj as Record<string, unknown>)[k])}`
  );
  return `{${pairs.join(',')}}`;
}

/**
 * Génère l'empreinte cryptographique chaînée d'un événement d'audit.
 *
 * Algorithme :
 *   payload = canonical_json({
 *     occurredAt, actorUserId, action, resourceType, resourceId,
 *     patientId, outcome, reasonText, tenantId, previousHash, seq
 *   })
 *   eventHash = SHA-256(payload)
 *
 * @param event L'événement à hasher (sans le hash, mais avec previousHash)
 * @returns L'empreinte SHA-256 préfixée
 */
export async function computeAuditEventHash(
  event: Pick<
    AuditEvent,
    | 'occurredAt'
    | 'actorUserId'
    | 'action'
    | 'resourceType'
    | 'resourceId'
    | 'patientId'
    | 'patientName'
    | 'outcome'
    | 'reasonText'
  > & { previousHash: string; tenantId: string; seq: number }
): Promise<string> {
  const canonical = canonicalJson({
    occurredAt: event.occurredAt,
    actorUserId: event.actorUserId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId || '',
    patientId: event.patientId || '',
    patientName: event.patientName || '',
    outcome: event.outcome,
    reasonText: event.reasonText || '',
    tenantId: event.tenantId,
    previousHash: event.previousHash,
    seq: event.seq,
  });
  return computeSha256(canonical);
}

/**
 * Vérifie l'intégrité d'une chaîne d'événements d'audit.
 *
 * @param events Liste ordonnée par `occurredAt` (ou `seq`)
 * @returns Un rapport de validation indiquant les ruptures éventuelles
 */
export interface AuditChainValidationResult {
  isValid: boolean;
  totalEvents: number;
  firstBrokenIndex: number | null;
  brokenEventId: string | null;
  expectedHash: string | null;
  actualHash: string | null;
  reason: string;
}

export async function validateAuditChain(
  events: AuditEvent[],
  tenantId: string
): Promise<AuditChainValidationResult> {
  if (events.length === 0) {
    return {
      isValid: true,
      totalEvents: 0,
      firstBrokenIndex: null,
      brokenEventId: null,
      expectedHash: null,
      actualHash: null,
      reason: 'Aucun événement à valider.',
    };
  }

  // Trier par timestamp pour reconstruire l'ordre de la chaîne
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );

  let previousHash = 'GENESIS'; // Convention : premier événement chaîne sur GENESIS

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];
    const expectedHash = await computeAuditEventHash({
      occurredAt: event.occurredAt,
      actorUserId: event.actorUserId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      patientId: event.patientId,
      patientName: event.patientName,
      outcome: event.outcome,
      reasonText: event.reasonText,
      previousHash,
      tenantId,
      seq: i + 1,
    });

    if (event.eventHash !== expectedHash) {
      return {
        isValid: false,
        totalEvents: sorted.length,
        firstBrokenIndex: i,
        brokenEventId: event.id,
        expectedHash,
        actualHash: event.eventHash || '',
        reason: `Rupture de chaîne à l'index ${i} (event ${event.id}). Hash attendu: ${expectedHash.substring(0, 24)}…, hash actuel: ${(event.eventHash || '').substring(0, 24)}…`,
      };
    }

    previousHash = event.eventHash!;
  }

  return {
    isValid: true,
    totalEvents: sorted.length,
    firstBrokenIndex: null,
    brokenEventId: null,
    expectedHash: null,
    actualHash: null,
    reason: `Chaîne valide sur ${sorted.length} événements.`,
  };
}

/**
 * Récupère le dernier hash connu pour un tenant donné.
 * Utilisé lors de la création d'un nouvel événement pour chaîner correctement.
 *
 * @param events Liste des événements existants du tenant
 * @returns Le hash du dernier événement, ou 'GENESIS' si la chaîne est vide
 */
export function getLastEventHash(events: AuditEvent[]): string {
  if (events.length === 0) return 'GENESIS';
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );
  return sorted[sorted.length - 1].eventHash || 'GENESIS';
}

/**
 * Génère un identifiant cryptographiquement aléatoire pour un événement.
 * Remplace `Math.random()` qui n'est PAS sûr pour un audit trail.
 */
export function generateSecureId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${Date.now()}_${random}`;
}

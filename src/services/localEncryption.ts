/**
 * Chiffrement local des données sensibles dans IndexedDB.
 *
 * Utilise l'API Web Crypto (AES-GCM 256 bits) pour chiffrer/déchiffrer
 * les champs sensibles avant stockage en IndexedDB.
 *
 * La clé de chiffrement est dérivée du machine code + un salt fixe
 * (pour ne pas demander un mot de passe supplémentaire à l'utilisateur).
 * En production avec Electron, la clé sera stockée dans le keychain OS.
 */

const ENC_PREFIX = 'enc:';

/**
 * Dériver une clé AES-GCM 256 à partir d'un secret (machine code).
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('onedesk-encryption-salt-v1'),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Chiffre une valeur (string ou objet) en AES-GCM.
 * Retourne une chaîne préfixée 'enc:' + base64(IV + ciphertext).
 */
export async function encryptValue(value: string, secret: string): Promise<string> {
  if (!value || value.startsWith(ENC_PREFIX)) return value; // Déjà chiffré

  try {
    const key = await deriveKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(value);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    // Combiner IV + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Base64
    const b64 = btoa(String.fromCharCode(...combined));
    return ENC_PREFIX + b64;
  } catch (err) {
    console.error('[encryption] Échec du chiffrement:', err);
    return value; // Fallback : stocke en clair (mieux que de perdre la donnée)
  }
}

/**
 * Déchiffre une valeur chiffrée.
 * Si la valeur n'est pas préfixée 'enc:', la retourne telle quelle.
 */
export async function decryptValue(value: string, secret: string): Promise<string> {
  if (!value || !value.startsWith(ENC_PREFIX)) return value;

  try {
    const b64 = value.substring(ENC_PREFIX.length);
    const combined = new Uint8Array(
      atob(b64).split('').map((c) => c.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const key = await deriveKey(secret);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('[encryption] Échec du déchiffrement:', err);
    return value; // Retourne la valeur chiffrée si échec
  }
}

/**
 * Chiffre sélectivement les champs sensibles d'un objet patient.
 * Les champs chiffrés : email, phone, address, insurance, emergencyContact.
 * Les champs non chiffrés : id, familyName, givenName, medicalRecordNumber, etc.
 * (besoin de les filtrer/trier en clair).
 */
const SENSITIVE_PATIENT_FIELDS: (keyof Patient)[] = [
  'email',
  'phone',
  'address',
  'insurance',
  'emergencyContact',
];

export async function encryptPatient(patient: Patient, secret: string): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...patient };
  for (const field of SENSITIVE_PATIENT_FIELDS) {
    const value = patient[field];
    if (value && typeof value === 'object') {
      result[field] = await encryptValue(JSON.stringify(value), secret);
    } else if (value && typeof value === 'string') {
      result[field] = await encryptValue(value, secret);
    }
  }
  return result;
}

export async function decryptPatient(record: Record<string, unknown>, secret: string): Promise<Patient> {
  const result: Record<string, unknown> = { ...record };
  for (const field of SENSITIVE_PATIENT_FIELDS) {
    const value = record[field];
    if (typeof value === 'string' && value.startsWith(ENC_PREFIX)) {
      const decrypted = await decryptValue(value, secret);
      try {
        result[field] = JSON.parse(decrypted);
      } catch {
        result[field] = decrypted;
      }
    }
  }
  return result as unknown as Patient;
}

/**
 * Chiffre les champs sensibles d'une note clinique (subjective, objective, assessment, plan).
 */
const SENSITIVE_NOTE_FIELDS = ['subjective', 'objective', 'assessment', 'plan'];

export async function encryptClinicalNote(
  note: Record<string, unknown>,
  secret: string
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...note };
  for (const field of SENSITIVE_NOTE_FIELDS) {
    const value = note[field];
    if (value && typeof value === 'object') {
      result[field] = await encryptValue(JSON.stringify(value), secret);
    }
  }
  return result;
}

export async function decryptClinicalNote(
  record: Record<string, unknown>,
  secret: string
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...record };
  for (const field of SENSITIVE_NOTE_FIELDS) {
    const value = record[field];
    if (typeof value === 'string' && value.startsWith(ENC_PREFIX)) {
      const decrypted = await decryptValue(value, secret);
      try {
        result[field] = JSON.parse(decrypted);
      } catch {
        result[field] = decrypted;
      }
    }
  }
  return result;
}

// Import type-only pour éviter la dépendance circulaire
import type { Patient } from '../types/clinical';

/**
 * Récupère le secret de chiffrement (machine code ou fallback).
 */
export function getEncryptionSecret(): string {
  // En mode Electron : window.getMachineCode()
  const electronMachineCode = (window as unknown as { getMachineCode?: () => string }).getMachineCode?.();
  if (electronMachineCode) return electronMachineCode;

  // En mode web : machine code simulé stocké en localStorage
  const stored = localStorage.getItem('onedesk_machine_code');
  if (stored) return stored;

  // Fallback : générer un machine code web
  const navInfo = `${navigator.userAgent}|${navigator.language}|${screen.width}x${screen.height}`;
  let hash = 0;
  for (let i = 0; i < navInfo.length; i++) {
    hash = ((hash << 5) - hash) + navInfo.charCodeAt(i);
    hash |= 0;
  }
  const machineCode = `web_${Math.abs(hash).toString(16).padStart(8, '0')}`;
  localStorage.setItem('onedesk_machine_code', machineCode);
  return machineCode;
}

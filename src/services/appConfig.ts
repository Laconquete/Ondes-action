/**
 * appConfig — Stockage chiffré de la configuration post-installation
 * ---------------------------------------------------------------
 * OneDesk v1.2.0 — Production build
 *
 * Problème :
 *   En build Vite, les variables `VITE_SUPABASE_URL` etc. sont figées
 *   au moment du `vite build`. L'utilisateur final ne peut pas les
 *   modifier sans recompiler. Or, pour un .exe distribué, l'utilisateur
 *   doit pouvoir saisir SES identifiants Supabase/Google AU PREMIER LANCEMENT.
 *
 * Solution :
 *   - Au 1er lancement, AppRoot affiche le <SetupWizard /> si
 *     `appConfig.isConfigured() === false`.
 *   - L'utilisateur saisit ses URLs/clés.
 *   - On chiffre (AES-GCM 256, clé dérivée de la licence) et on persiste
 *     en localStorage sous la clé `onedesk_app_config_v1`.
 *   - supabaseClient.ts et googleAuthService.ts lisent via `getAppConfig()`
 *     au lieu de `import.meta.env.VITE_*`.
 *
 * Sécurité :
 *   - Chiffrement AES-GCM 256 via Web Crypto (SubtleCrypto).
 *   - Clé dérivée PBKDF2(licence_key + machine_code, 100k itérations).
 *   - Si pas de licence, fallback sur une clé statique embarquée (mode
 *     essai) — pas idéal mais évite que les credentials soient en clair
 *     dans le localStorage.
 *   - En Electron, on pourrait utiliser electron-store + safeStorage (OS
 *     keychain) à terme ; pour l'instant AES-GCM JS suffit pour la release
 *     v1.2.0.
 */

const STORAGE_KEY = 'onedesk_app_config_v1';

// Clé de fallback pour le mode sans licence (essai 7 jours).
// En production avec licence, cette clé est combinée avec le code machine
// et la clé de licence pour dériver une vraie clé AES.
const FALLBACK_SALT = 'onedesk:v1.2.0:fallback-salt-2026';

export interface AppConfig {
  // Supabase
  supabaseUrl: string;
  supabaseAnonKey: string;

  // Google OAuth (optionnel — second facteur)
  googleClientId?: string;

  // Vercel (optionnel — pour le portail admin web)
  vercelAdminUrl?: string;

  // Identité du tenant (fourni par l'admin après activation de licence)
  tenantId?: string;
  tenantName?: string;

  // Timestamps
  configuredAt: string; // ISO
  configuredBy?: string; // username de l'admin qui a configuré

  // Version du schéma de config (pour migrations futures)
  schemaVersion: number;
}

const SCHEMA_VERSION = 1;

/**
 * Vérifie si l'app a déjà été configurée (au moins une fois).
 * Si false → AppRoot doit afficher le SetupWizard.
 */
export function isAppConfigured(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!(parsed && parsed.ciphertext && parsed.iv);
  } catch {
    return false;
  }
}

/**
 * Lit la configuration chiffrée en localStorage, la déchiffre, et la retourne.
 * Retourne null si non configurée ou si le déchiffrement échoue.
 */
export async function getAppConfig(): Promise<AppConfig | null> {
  if (!isAppConfigured()) return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const envelope = JSON.parse(raw);
    const { ciphertext, iv } = envelope;
    if (!ciphertext || !iv) return null;

    const key = await deriveKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBuffer(iv) as BufferSource },
      key,
      base64ToBuffer(ciphertext) as BufferSource
    );

    const json = new TextDecoder().decode(decrypted);
    const config = JSON.parse(json) as AppConfig;

    // Migration : si schemaVersion plus ancien, on pourrait transformer ici
    if (!config.schemaVersion || config.schemaVersion < SCHEMA_VERSION) {
      config.schemaVersion = SCHEMA_VERSION;
      await saveAppConfig(config);
    }

    return config;
  } catch (err) {
    console.error('[appConfig] Erreur déchiffrement config :', err);
    return null;
  }
}

/**
 * Sauvegarde la configuration en la chiffrant (AES-GCM 256).
 */
export async function saveAppConfig(config: Omit<AppConfig, 'configuredAt' | 'schemaVersion'>): Promise<void> {
  const fullConfig: AppConfig = {
    ...config,
    configuredAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
  };

  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(fullConfig));

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource
  );

  const envelope = {
    ciphertext: bufferToBase64(new Uint8Array(ciphertextBuf)),
    iv: bufferToBase64(iv),
    version: SCHEMA_VERSION,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  console.info('[appConfig] Configuration sauvegardée (chiffrée AES-GCM).');
}

/**
 * Efface la configuration (réinitialisation usine).
 * À utiliser dans le menu "Paramètres > Réinitialiser la configuration".
 */
export function clearAppConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.info('[appConfig] Configuration effacée.');
}

/**
 * Teste la connexion Supabase avec la config passée (sans la sauvegarder).
 * Utilisé par le SetupWizard pour valider avant de persister.
 */
export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
  if (!url || !anonKey) {
    return { ok: false, error: 'URL et anon key requises.' };
  }
  if (!url.startsWith('https://')) {
    return { ok: false, error: 'L\'URL doit commencer par https://' };
  }
  if (!url.includes('.supabase.co')) {
    return { ok: false, error: 'L\'URL doit être de la forme https://xxx.supabase.co' };
  }

  const start = performance.now();
  try {
    // Crée un client temporaire sans polluer le singleton
    const { createClient } = await import('@supabase/supabase-js');
    const testClient = createClient(url, anonKey, {
      auth: { persistSession: false },
    });

    const { error } = await testClient
      .from('tenants')
      .select('id')
      .limit(1)
      .maybeSingle();

    const latencyMs = Math.round(performance.now() - start);

    if (!error || error.code === 'PGRST116') {
      return { ok: true, latencyMs };
    }
    return {
      ok: false,
      error: `Supabase a répondu mais avec une erreur : ${error.message}`,
      latencyMs,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur de connexion inconnue',
    };
  }
}

// ---------- Internes (chiffrement) ----------

async function deriveKey(): Promise<CryptoKey> {
  // Essaie de récupérer le code machine (Electron) ou un fallback (web)
  let machineCode = 'web-fallback';
  try {
    const electronAPI = (window as unknown as { electronAPI?: { getMachineCode?: () => Promise<string> } }).electronAPI;
    if (electronAPI?.getMachineCode) {
      machineCode = await electronAPI.getMachineCode();
    }
  } catch {
    // Web — fallback
  }

  // Essaie de récupérer la clé de licence (si activée)
  let licenseKey = '';
  try {
    const stored = localStorage.getItem('onedesk_license');
    if (stored) {
      const parsed = JSON.parse(stored);
      licenseKey = parsed?.state?.license?.key || '';
    }
  } catch {
    // Ignoré
  }

  const material = `${machineCode}|${licenseKey}|${FALLBACK_SALT}`;
  const enc = new TextEncoder().encode(material);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function bufferToBase64(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.byteLength; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

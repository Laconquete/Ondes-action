import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getAppConfig, isAppConfigured } from './appConfig';

/**
 * Client Supabase — singleton initialisé paresseusement.
 *
 * Architecture v1.2.0 (production) :
 *  - Au 1er lancement, AppRoot affiche le <SetupWizard /> si la config
 *    n'est pas encore saisie (appConfig.isConfigured() === false).
 *  - L'utilisateur saisit URL + anon key + Google OAuth + tenant.
 *  - Ces valeurs sont chiffrées (AES-GCM) en localStorage.
 *  - Au démarrage, AppRoot appelle `await preloadSupabaseFromConfig()`
 *    qui lit appConfig de façon async, instancie le client, et le met en cache.
 *  - Les composants React appellent `getSupabase()` (SYNC) — ils récupèrent
 *    le client pré-chargé ou null si non configuré.
 *
 * Sécurité :
 *  - L'anon key est publique par design (RLS protège les données).
 *  - Les politiques RLS du schéma SQL garantissent qu'un utilisateur ne voit
 *    QUE les données de son tenant_id et selon son rôle.
 *  - En mode offline (pas de config), les données restent en IndexedDB local.
 */

let cachedClient: SupabaseClient | null = null;
let cachedConfigHash: string | null = null;
let preloaded = false;

/**
 * PRÉ-CHARGEMENT (async, à appeler une fois au démarrage de AppRoot).
 * Lit la config chiffrée, instancie le client, le met en cache.
 * Après cet appel, getSupabase() (sync) renvoie le client.
 *
 * Idempotent : peut être appelée plusieurs fois sans effet de bord.
 * Si la config a changé (reconfiguration), recrée le client.
 */
export async function preloadSupabaseFromConfig(): Promise<void> {
  if (!isAppConfigured()) {
    console.info('[supabaseClient] Mode offline — config non saisie. Sync désactivé.');
    cachedClient = null;
    cachedConfigHash = null;
    preloaded = true;
    return;
  }

  const config = await getAppConfig();
  if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
    console.warn('[supabaseClient] Config présente mais invalide. Sync désactivé.');
    cachedClient = null;
    preloaded = true;
    return;
  }

  const configHash = `${config.supabaseUrl}|${config.supabaseAnonKey.substring(0, 16)}`;
  if (cachedClient && cachedConfigHash === configHash) {
    preloaded = true;
    return; // déjà chargé
  }

  try {
    cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // Pour le callback OAuth Google
      },
      realtime: {
        params: { eventsPerSecond: 1 },
      },
      global: {
        headers: {
          'x-client-info': 'onedesk-sync/1.2.0',
        },
      },
    });
    cachedConfigHash = configHash;
    preloaded = true;
    console.info('[supabaseClient] Client Supabase initialisé depuis appConfig chiffré.');
  } catch (err) {
    console.error('[supabaseClient] Échec d\'initialisation:', err);
    cachedClient = null;
    preloaded = true;
  }
}

/**
 * Retourne le client Supabase si configuré, sinon null.
 * SYNC — renvoie le client pré-chargé par preloadSupabaseFromConfig().
 *
 * Si preloadSupabaseFromConfig() n'a pas été appelé, retourne null et log un avertissement.
 * Les composants doivent toujours appeler `await preloadSupabaseFromConfig()` au démarrage
 * (AppRoot le fait).
 */
export function getSupabase(): SupabaseClient | null {
  if (!preloaded) {
    // Tentative de préchargement synchrone impossible (AES-GCM est async).
    // AppRoot doit appeler preloadSupabaseFromConfig() avant tout rendu.
    console.warn('[supabaseClient] getSupabase() appelé avant preload. Retourne null. Appelez preloadSupabaseFromConfig() au démarrage.');
    return null;
  }
  return cachedClient;
}

/**
 * Indique si Supabase est configuré (config chiffrée présente + pré-chargée).
 * SYNC — utilisée par les composants React pour décider d'afficher Google OAuth, etc.
 */
export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}

/**
 * Teste la connectivité au backend Supabase en effectuant un ping léger.
 * Retourne true si la connexion est active, false sinon.
 */
export async function pingSupabase(): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client
      .from('tenants')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!error || error.code === 'PGRST116') return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Réinitialise le client (pour tests, déconnexion, ou reconfiguration).
 * Après cet appel, il faut rappeler preloadSupabaseFromConfig() pour recharger.
 */
export function resetSupabaseClient(): void {
  cachedClient = null;
  cachedConfigHash = null;
  preloaded = false;
}

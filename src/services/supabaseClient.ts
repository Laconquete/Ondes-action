import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase — singleton initialisé paresseusement.
 *
 * Architecture Offline-First :
 *  - Si VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY ne sont PAS définies → retourne null.
 *    L'app fonctionne alors en mode 100% local (IndexedDB), sans aucune sync.
 *    C'est le mode "démo" ou "installation standalone".
 *  - Si les variables SONT définies → le client est créé à la première utilisation
 *    et réutilisé (singleton). Le syncWorker peut alors pousser l'outbox et tirer les changements.
 *
 * Sécurité :
 *  - L'anon key est publique par design (elle ne donne accès qu'aux données permises par RLS).
 *  - Les politiques RLS du schéma SQL garantissent qu'un utilisateur ne voit QUE les données
 *    de son tenant_id et selon son rôle (doctor/nurse/receptionist/auditor).
 *  - En mode offline (pas de Supabase), les données restent chiffrées en IndexedDB local.
 */

let cachedClient: SupabaseClient | null = null;
let initAttempted = false;

/**
 * Retourne le client Supabase si configuré, sinon null.
 * Le premier appel initialise le client ; les appels suivants retournent le cache.
 */
export function getSupabase(): SupabaseClient | null {
  if (initAttempted) return cachedClient;
  initAttempted = true;

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !anonKey || url === 'MY_SUPABASE_URL' || anonKey === 'MY_SUPABASE_ANON_KEY') {
    // Mode offline — pas de sync Supabase. L'app fonctionne 100% en local.
    console.info('[supabaseClient] Mode offline — Supabase non configuré. Sync désactivé.');
    return null;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        // IMPORTANT : on active la persistance de session pour permettre
        // l'usage offline (JWT caché en localStorage, auto-refresh quand online).
        // Supabase Auth gère le refresh automatiquement.
        persistSession: true,
        autoRefreshToken: true,
        // On garde le storage par défaut (localStorage) pour la persistance offline.
        // En production Electron, on utilisera un storage sécurisé (electron-store).
        detectSessionInUrl: true, // Pour le callback OAuth Google
      },
      realtime: {
        // Désactivé pour simplifier — on utilise du polling (30s) plutôt que WebSocket.
        params: { eventsPerSecond: 1 },
      },
      global: {
        headers: {
          'x-client-info': 'onedesk-sync/1.0.0',
        },
      },
    });

    console.info('[supabaseClient] Client Supabase initialisé. Auth + sync activés.');
    return cachedClient;
  } catch (err) {
    console.error('[supabaseClient] Échec d\'initialisation:', err);
    return null;
  }
}

/**
 * Indique si la sync Supabase est disponible (variables d'env configurées).
 * Utilisé par le syncWorker pour décider s'il doit tenter des requêtes réseau.
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
    // Ping minimal : SELECT 1 sur la table tenants (la plus légère).
    const { error } = await client
      .from('tenants')
      .select('id')
      .limit(1)
      .maybeSingle();

    // Pas d'erreur OU erreur "PGRST116" (no rows) = connexion OK
    if (!error || error.code === 'PGRST116') return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Réinitialise le client (pour tests ou déconnexion).
 */
export function resetSupabaseClient(): void {
  cachedClient = null;
  initAttempted = false;
}

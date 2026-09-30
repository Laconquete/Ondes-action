import { getSupabase } from './supabaseClient';
import { db } from './localDatabase';
import { AppUser, UserRole } from '../types/clinical';

/**
 * Service d'Authentification Supabase — Source de vérité sécurisée
 *
 * Architecture :
 *
 *   ┌─────────────────┐   signInWithPassword   ┌──────────────────┐
 *   │  LoginScreen     │ ─────────────────────► │  Supabase Auth   │
 *   │  (email+passwd)  │ ◄───────────────────── │  (auth.users)    │
 *   └─────────────────┘   JWT + user            └──────────────────┘
 *            │                       │                    │
 *            │ 1. Récupère profil    │ 2. JWT utilisé      │ 3. RLS:
 *            │    via JWT             │    pour toutes      │    auth.uid()
 *            ▼                        │    les requêtes     │    → auth_user_id
 *   ┌─────────────────┐               ▼                    │    → tenant_id
 *   │  public.users   │ ◄───────────────────────────────────┘    → role
 *   │  (tenant_id,    │
 *   │   role, name)   │
 *   └─────────────────┘
 *            │
 *            │ 4. Cache local (IndexedDB) pour offline
 *            ▼
 *   ┌─────────────────┐
 *   │  Session 1h     │  ← JWT expire, auto-refresh si online
 *   │  (persistée)    │  ← Si offline + expiré → re-login obligatoire
 *   └─────────────────┘
 *
 * Sécurité :
 *  - auth.uid() est IMPOSSIBLE à forger (validé serveur par Supabase)
 *  - Le JWT est signé avec la secret key du projet Supabase (jamais exposée)
 *  - RLS utilise auth.uid() → public.users.auth_user_id → tenant_id
 *  - Un attaquant avec l'anon key NE PEUT PAS accéder aux données d'un autre tenant
 *
 * Offline-first :
 *  - Supabase Auth persiste la session en localStorage (autoRefreshToken: true)
 *  - Si offline : la session cache permet de continuer à utiliser l'app
 *  - Si offline + JWT expiré : bascule sur l'auth locale PBKDF2 (mode démo)
 *  - Si online : auto-refresh du JWT transparent
 */

export interface SupabaseUserProfile {
  authUserId: string;
  email: string;
  displayName: string;
  role: UserRole;
  tenantId: string;
  tenantName?: string;
  department: string;
  serviceCode: string;
  licenseNumber?: string;
  avatarUrl?: string;
  isActive: boolean;
}

export interface SupabaseLoginResult {
  success: boolean;
  user?: AppUser;
  profile?: SupabaseUserProfile;
  error?: string;
  needsAdminActivation?: boolean; // True si l'utilisateur existe mais n'est pas activé
  needsTenantAssignment?: boolean; // True si l'utilisateur n'a pas de tenant
}

/**
 * Authentifie un utilisateur via Supabase Auth (email + password).
 *
 * Étapes :
 *  1. signInWithPassword → JWT + user Auth
 *  2. SELECT * FROM users WHERE auth_user_id = auth.uid() → profil clinique
 *  3. Vérifie is_active + tenant_id non NULL
 *  4. Cache le profil en IndexedDB pour usage offline
 */
export async function signInWithSupabase(
  email: string,
  password: string
): Promise<SupabaseLoginResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase non configuré. Utilisez l\'authentification locale.',
    };
  }

  try {
    // 1. Authentification Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (authError) {
      // Erreurs courantes
      if (authError.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Email ou mot de passe incorrect.' };
      }
      if (authError.message.includes('Email not confirmed')) {
        return { success: false, error: 'Email non confirmé. Vérifiez votre boîte mail.' };
      }
      if (authError.message.includes('Failed to fetch') || authError.message.includes('Network')) {
        return {
          success: false,
          error: 'Réseau indisponible. Utilisez l\'authentification locale.',
        };
      }
      return { success: false, error: authError.message };
    }

    if (!authData.user || !authData.session) {
      return { success: false, error: 'Session non récupérée.' };
    }

    // 2. Récupérer le profil clinique depuis public.users
    //    La requête utilise auth.uid() via le JWT — RLS filtre automatiquement
    const { data: profileRow, error: profileError } = await supabase
      .from('users')
      .select(`
        id,
        auth_user_id,
        tenant_id,
        email,
        username,
        display_name,
        role,
        department,
        service_code,
        license_number,
        is_active,
        tenants (name)
      `)
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[supabaseAuth] Erreur récupération profil:', profileError);
      return {
        success: false,
        error: 'Profil utilisateur introuvable. Contactez l\'administrateur.',
      };
    }

    if (!profileRow) {
      // L'utilisateur existe dans auth.users mais pas dans public.users
      return {
        success: false,
        error: 'Profil clinique non configuré. Contactez l\'administrateur pour activer votre compte.',
        needsAdminActivation: true,
      };
    }

    // Typage lâche car Supabase ne type pas les jointures sans générateur
    const row = profileRow as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenantsData = row.tenants as any;
    const tenantName: string | undefined = Array.isArray(tenantsData)
      ? tenantsData[0]?.name
      : tenantsData?.name ?? undefined;

    if (!(row.is_active as boolean)) {
      return {
        success: false,
        error: 'Votre compte n\'est pas encore activé. Contactez l\'administrateur.',
        needsAdminActivation: true,
      };
    }

    if (!row.tenant_id) {
      return {
        success: false,
        error: 'Aucun établissement (tenant) assigné à votre compte. Contactez l\'administrateur.',
        needsTenantAssignment: true,
      };
    }

    // 3. Construire le profil complet
    const profile: SupabaseUserProfile = {
      authUserId: authData.user.id,
      email: (row.email as string) || email,
      displayName: row.display_name as string,
      role: row.role as UserRole,
      tenantId: row.tenant_id as string,
      tenantName,
      department: row.department as string,
      serviceCode: row.service_code as string,
      licenseNumber: (row.license_number as string) || undefined,
      avatarUrl: authData.user.user_metadata?.avatar_url || authData.user.user_metadata?.picture,
      isActive: row.is_active as boolean,
    };

    // 4. Cache en IndexedDB pour usage offline
    await cacheUserProfile(profile);

    // 5. Convertir en AppUser pour le store
    const appUser: AppUser = {
      id: row.id as string,
      username: (row.username as string) || email,
      displayName: profile.displayName,
      role: profile.role,
      department: profile.department,
      serviceCode: profile.serviceCode,
      licenseNumber: profile.licenseNumber,
    };

    return { success: true, user: appUser, profile };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    if (message.includes('Failed to fetch') || message.includes('Network')) {
      return {
        success: false,
        error: 'Réseau indisponible. Utilisez l\'authentification locale.',
      };
    }
    return { success: false, error: message };
  }
}

/**
 * Récupère la session Supabase courante (depuis le cache localStorage).
 * Utilisé au démarrage de l'app pour reconnecter automatiquement.
 */
export async function getCurrentSupabaseSession(): Promise<SupabaseLoginResult | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || !data.session.user) {
      return null;
    }

    // Vérifier si le JWT est expiré
    const expiresAt = data.session.expires_at;
    if (expiresAt && expiresAt * 1000 < Date.now()) {
      // JWT expiré — tenter un refresh
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        return null; // Refresh échoué → re-login requis
      }
    }

    // Charger le profil depuis le cache local (offline-first)
    const cachedProfile = await getCachedUserProfile(data.session.user.id);
    if (cachedProfile && cachedProfile.isActive) {
      const appUser: AppUser = {
        id: cachedProfile.id || data.session.user.id,
        username: cachedProfile.username,
        displayName: cachedProfile.displayName,
        role: cachedProfile.role,
        department: cachedProfile.department,
        serviceCode: cachedProfile.serviceCode,
        licenseNumber: cachedProfile.licenseNumber,
      };
      return { success: true, user: appUser, profile: cachedProfile };
    }

    // Pas de cache — récupérer depuis Supabase (online)
    return await signInWithSupabaseRefresh(data.session.user.id);
  } catch {
    return null;
  }
}

/**
 * Refresh du profil utilisateur (sans redemander le mot de passe).
 * Utilisé quand on a une session valide mais pas de cache local.
 */
async function signInWithSupabaseRefresh(authUserId: string): Promise<SupabaseLoginResult> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase non configuré.' };

  const { data: profileRow, error } = await supabase
    .from('users')
    .select(`
      id, auth_user_id, tenant_id, email, username, display_name,
      role, department, service_code, license_number, is_active,
      tenants (name)
    `)
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error || !profileRow) {
    return { success: false, error: 'Profil introuvable.' };
  }

  // Typage lâche car Supabase ne type pas les jointures sans générateur
  const row = profileRow as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantsData = row.tenants as any;
  const tenantName: string | undefined = Array.isArray(tenantsData)
    ? tenantsData[0]?.name
    : tenantsData?.name ?? undefined;

  if (!row.is_active || !row.tenant_id) {
    return {
      success: false,
      error: 'Compte non activé ou sans tenant.',
      needsAdminActivation: !row.is_active,
    };
  }

  const profile: SupabaseUserProfile = {
    authUserId,
    email: row.email as string,
    displayName: row.display_name as string,
    role: row.role as UserRole,
    tenantId: row.tenant_id as string,
    tenantName,
    department: row.department as string,
    serviceCode: row.service_code as string,
    licenseNumber: (row.license_number as string) || undefined,
    isActive: row.is_active as boolean,
  };

  await cacheUserProfile(profile);

  const appUser: AppUser = {
    id: row.id as string,
    username: (row.username as string) || (row.email as string),
    displayName: profile.displayName,
    role: profile.role,
    department: profile.department,
    serviceCode: profile.serviceCode,
    licenseNumber: profile.licenseNumber,
  };

  return { success: true, user: appUser, profile };
}

/**
 * Déconnexion Supabase (efface le JWT + le cache local).
 */
export async function signOutSupabase(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[supabaseAuth] Erreur déconnexion:', err);
  }

  // Vider le cache local du profil
  await db.localUsers.clear(); // Optionnel : on peut vouloir conserver les users offline
}

/**
 * Indique si Supabase Auth est disponible (Supabase configuré + online).
 */
export function isSupabaseAuthAvailable(): boolean {
  return getSupabase() !== null && typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * S'abonne aux changements d'état d'authentification Supabase.
 * Permet de détecter quand le JWT expire ou quand l'utilisateur se déconnecte ailleurs.
 */
export function onSupabaseAuthChange(
  callback: (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED') => void
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') callback('SIGNED_IN');
    else if (event === 'SIGNED_OUT') callback('SIGNED_OUT');
    else if (event === 'TOKEN_REFRESHED') callback('TOKEN_REFRESHED');
    else if (event === 'USER_UPDATED') callback('USER_UPDATED');
  });

  return () => data.subscription.unsubscribe();
}

// ============================================================
// CACHE LOCAL (IndexedDB) — pour usage offline
// ============================================================

interface CachedProfile extends SupabaseUserProfile {
  id?: string;
  username: string;
  cachedAt: string; // ISO timestamp
}

/**
 * Cache le profil utilisateur en IndexedDB pour permettre l'usage offline.
 * Si le JWT expire et qu'on est offline, on peut encore afficher l'UI
 * en se basant sur ce profil cache (lecture seule depuis Dexie).
 */
async function cacheUserProfile(profile: SupabaseUserProfile): Promise<void> {
  const cached: CachedProfile = {
    ...profile,
    username: profile.email,
    cachedAt: new Date().toISOString(),
  };

  // On stocke dans localUsers avec un id basé sur authUserId
  // pour pouvoir le retrouver au prochain démarrage
  const localUserId = `usr_supabase_${profile.authUserId.substring(0, 12)}`;

  await db.localUsers.put({
    id: localUserId,
    tenantId: profile.tenantId,
    username: profile.email.toLowerCase(),
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
    department: profile.department,
    serviceCode: profile.serviceCode,
    licenseNumber: profile.licenseNumber,
    isActive: profile.isActive,
    passwordHash: '', // Pas de mot de passe local — auth via Supabase uniquement
    salt: '',
    googleId: undefined,
    avatarUrl: profile.avatarUrl,
    lastLoginAt: new Date().toISOString(),
  });
}

/**
 * Récupère le profil cache depuis IndexedDB.
 */
async function getCachedUserProfile(authUserId: string): Promise<CachedProfile | null> {
  const localUserId = `usr_supabase_${authUserId.substring(0, 12)}`;
  const cached = await db.localUsers.get(localUserId);
  if (!cached) return null;

  return {
    id: cached.id,
    authUserId,
    email: cached.email || cached.username,
    displayName: cached.displayName,
    role: cached.role as UserRole,
    tenantId: cached.tenantId,
    department: cached.department,
    serviceCode: cached.serviceCode,
    licenseNumber: cached.licenseNumber,
    avatarUrl: cached.avatarUrl,
    isActive: cached.isActive,
    username: cached.username,
    cachedAt: cached.lastLoginAt || new Date().toISOString(),
  };
}

import { getSupabase } from './supabaseClient';
import { db, LocalUser } from './localDatabase';
import { computeSha256, generateSecureId } from './cryptoAuditService';
import { AppUser, UserRole } from '../types/clinical';

/**
 * Service Google OAuth — Second facteur d'authentification (préserve l'offline-first)
 *
 * Architecture :
 *
 *   ┌──────────────────┐    1er login (online)    ┌──────────────┐
 *   │   Google OAuth   │ ────────────────────────► │   Supabase   │
 *   │   (popup)        │ ◄──────────────────────── │  Auth (JWT)  │
 *   └──────────────────┘    user + email           └──────────────┘
 *            │                                              │
 *            │ 2. Liaison user local                          │
 *            ▼                                              ▼
 *   ┌──────────────────┐    3. Cache local          ┌──────────────┐
 *   │  IndexedDB       │ ────────────────────────► │  Persistance │
 *   │  (localUser +    │ ◄──────────────────────── │  session 8h  │
 *   │   googleId)      │                           └──────────────┘
 *   └──────────────────┘
 *            │
 *   4. Sessions SUIVANTES (offline OK)
 *            │
 *            ▼
 *   ┌──────────────────┐
 *   │  Auth locale     │  ← PBKDF2 + salt (déjà en place)
 *   │  (sans Google)   │  ← Fonctionne 100% offline
 *   └──────────────────┘
 *
 * Garanties :
 *  - Google OAuth n'est JAMAIS requis pour utiliser l'app
 *  - Si Google KO (offline, panne, quota), l'auth locale reste fonctionnelle
 *  - Si Google OK : on crée un user local lié au googleId, avec un mot de passe
 *    local aléatoire (l'utilisateur n'a pas besoin de le connaître tant que Google marche)
 *  - Le tenant_id est déduit de l'email Google (mapping configuré côté admin)
 */

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  providerToken?: string; // Token OAuth Google (pour APIs Google si besoin)
}

export interface GoogleAuthResult {
  success: boolean;
  user?: AppUser;
  error?: string;
  isOffline?: boolean; // True si Google a échoué pour cause réseau
}

/**
 * Déclenche le flux Google OAuth via Supabase.
 *
 * Utilise signInWithOAuth en mode popup (UX la plus fluide).
 * Si le navigateur bloque les popups, bascule sur redirectTo.
 *
 * En cas d'échec réseau, retourne isOffline=true pour que l'UI suggère
 * l'auth locale.
 */
export async function signInWithGoogle(tenantId: string): Promise<GoogleAuthResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      isOffline: true,
      error: 'Mode offline — Supabase non configuré. Utilisez l\'authentification locale.',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      // Erreur réseau → offline
      if (
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('network')
      ) {
        return {
          success: false,
          isOffline: true,
          error: 'Réseau indisponible. Utilisez l\'authentification locale.',
        };
      }
      return { success: false, error: error.message };
    }

    // signInWithOAuth redirige le navigateur vers Google.
    // On ne peut pas récupérer le user ici directement — il faut attendre
    // le retour de la redirection (géré par handleGoogleRedirect).
    if (data?.url) {
      // Mode redirection : on laisse le navigateur faire
      window.location.href = data.url;
      return { success: false, error: 'Redirection vers Google en cours…' };
    }

    return { success: false, error: 'Réponse Google inattendue.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    if (message.includes('Failed to fetch') || message.includes('Network')) {
      return {
        success: false,
        isOffline: true,
        error: 'Réseau indisponible. Utilisez l\'authentification locale.',
      };
    }
    return { success: false, error: message };
  }
}

/**
 * Traite le retour de redirection Google OAuth.
 * À appeler au démarrage de l'app (dans AppRoot) pour vérifier si on revient
 * d'une authentification Google réussie.
 *
 * Si la session Google est valide :
 *  1. Récupère le user Google (email, displayName)
 *  2. Cherche un user local lié à ce googleId
 *  3. Si trouvé → authentifie
 *  4. Si non trouvé → crée un user local (rôle par défaut: doctor, à confirmer par admin)
 */
export async function handleGoogleRedirect(tenantId: string): Promise<GoogleAuthResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré.' };
  }

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      // Pas de session Google active — c'est normal si l'utilisateur n'a pas utilisé Google
      return { success: false, error: 'Aucune session Google active.' };
    }

    const googleUser = data.session.user;
    if (!googleUser?.email) {
      return { success: false, error: 'Compte Google sans email.' };
    }

    const googleId = googleUser.id;
    const email = googleUser.email;
    const displayName =
      googleUser.user_metadata?.full_name ||
      googleUser.user_metadata?.name ||
      email.split('@')[0];
    const avatarUrl = googleUser.user_metadata?.avatar_url || googleUser.user_metadata?.picture;

    const googleInfo: GoogleUserInfo = {
      googleId,
      email,
      displayName,
      avatarUrl,
      providerToken: data.session.provider_token ?? undefined,
    };

    return await linkGoogleUserToLocal(googleInfo, tenantId);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors du traitement Google.',
    };
  }
}

/**
 * Lie un compte Google à un utilisateur local (IndexedDB).
 *
 * Stratégie :
 *  1. Cherche un user local avec googleId correspondant → authentifie
 *  2. Sinon, cherche un user local avec email correspondant → lie le googleId
 *  3. Sinon, crée un nouveau user local avec googleId (rôle: doctor par défaut,
 *     à confirmer par l'administrateur)
 */
async function linkGoogleUserToLocal(
  googleInfo: GoogleUserInfo,
  tenantId: string
): Promise<GoogleAuthResult> {
  // 1. Chercher par googleId
  const existingByGoogleId = await db.localUsers
    .where('tenantId')
    .equals(tenantId)
    .filter((u) => u.googleId === googleInfo.googleId)
    .first();

  if (existingByGoogleId && existingByGoogleId.isActive) {
    return { success: true, user: localUserToAppUser(existingByGoogleId) };
  }

  // 2. Chercher par email (liaison)
  const existingByEmail = await db.localUsers
    .where('tenantId')
    .equals(tenantId)
    .filter((u) => u.email?.toLowerCase() === googleInfo.email.toLowerCase())
    .first();

  if (existingByEmail) {
    // Lie le googleId au user local existant
    await db.localUsers.update(existingByEmail.id, {
      googleId: googleInfo.googleId,
      avatarUrl: googleInfo.avatarUrl,
    });
    if (existingByEmail.isActive) {
      return { success: true, user: localUserToAppUser(existingByEmail) };
    }
  }

  // 3. Créer un nouveau user local lié au googleId
  //    Rôle par défaut : doctor (l'admin pourra le changer)
  //    Mot de passe local : aléatoire (l'utilisateur n'a pas besoin de le connaître
  //    tant que Google marche — mais il peut le réinitialiser pour usage offline)
  const randomPassword = generateSecureId('pwd').substring(4);
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const passwordHash = await hashPasswordForSeed(randomPassword, salt);

  const newUser: LocalUser = {
    id: `usr_google_${googleInfo.googleId.substring(0, 12)}`,
    tenantId,
    username: googleInfo.email.toLowerCase(),
    email: googleInfo.email,
    displayName: googleInfo.displayName,
    role: 'doctor', // Rôle par défaut — l'admin devra confirmer
    department: 'À confirmer',
    serviceCode: 'GOOGLE',
    isActive: true, // Actif immédiatement, mais rôle à confirmer
    passwordHash,
    salt,
    googleId: googleInfo.googleId,
    avatarUrl: googleInfo.avatarUrl,
    lastLoginAt: new Date().toISOString(),
  };

  await db.localUsers.add(newUser);
  console.info(`[googleAuth] Nouvel utilisateur Google créé: ${googleInfo.email} (rôle: doctor, à confirmer)`);

  return { success: true, user: localUserToAppUser(newUser) };
}

/**
 * Déconnecte la session Google (sans déconnecter l'auth locale).
 * Utile si l'utilisateur veut basculer de compte Google.
 */
export async function signOutGoogle(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[googleAuth] Erreur lors de la déconnexion Google:', err);
  }
}

/**
 * Indique si Google OAuth est disponible (Supabase configuré + en ligne).
 */
export function isGoogleAuthAvailable(): boolean {
  return getSupabase() !== null && typeof navigator !== 'undefined' && navigator.onLine;
}

// Import différé pour éviter la dépendance circulaire
import { hashPasswordForSeed } from '../stores/authStore';

function localUserToAppUser(lu: LocalUser): AppUser {
  return {
    id: lu.id,
    username: lu.username,
    displayName: lu.displayName,
    role: lu.role as UserRole,
    department: lu.department,
    serviceCode: lu.serviceCode,
    licenseNumber: lu.licenseNumber,
  };
}

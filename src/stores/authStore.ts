import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppUser, UserRole } from '../types/clinical';
import { db, LocalUser } from '../services/localDatabase';
import { computeSha256 } from '../services/cryptoAuditService';

/**
 * Store d'Authentification — remplace le `<select>` du Header
 *
 * Architecture :
 *  - L'utilisateur saisit username + mot de passe
 *  - Le mot de passe est hashé (PBKDF2 + salt, 100k itérations via Web Crypto) et comparé au hash local (Dexie)
 *  - Une session est créée avec expiration 8h (révocable manuellement)
 *  - Le RBAC est strictement appliqué : un réceptionniste ne peut JAMAIS accéder aux prix/prescriptions
 *  - La session est persistée dans localStorage pour survivre au refresh
 *  - En cas d'expiration, l'utilisateur est redirigé vers l'écran de login
 *
 * Sécurité :
 *  - Le mot de passe ne transite JAMAIS en clair après le hash initial
 *  - Le token de session est un Uint8Array aléatoire de 32 bytes
 *  - Le token est stocké uniquement sous forme hashée en base
 */

interface AuthSession {
  user: AppUser;
  sessionId: string;
  tokenHash: string;
  expiresAt: string;
}

interface AuthState {
  currentUser: AppUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tenantId: string | null;
  tenantName: string | null;

  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithSupabase: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsAdminActivation?: boolean; needsTenantAssignment?: boolean }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string; isOffline?: boolean }>;
  completeGoogleLogin: (user: AppUser) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;

  activeBreakGlass: {
    patientId: string;
    justification: string;
    expiresAt: string;
    startedAt: string;
  } | null;
  startBreakGlass: (patientId: string, justification: string) => void;
  endBreakGlass: () => void;
  isBreakGlassActive: () => boolean;

  configureTenant: (tenantId: string, tenantName: string) => void;
}

const SESSION_DURATION_HOURS = 8;
const BREAK_GLASS_DURATION_MINUTES = 30;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Rate limiting : compte les tentatives de login échouées.
 * Après MAX_LOGIN_ATTEMPTS échecs → blocage pendant LOCKOUT_DURATION_MS.
 */
interface RateLimitState {
  attempts: number;
  lockedUntil: number | null; // timestamp
}

function getRateLimitState(): RateLimitState {
  const stored = localStorage.getItem('onedesk_rate_limit');
  if (!stored) return { attempts: 0, lockedUntil: null };
  try {
    return JSON.parse(stored);
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function saveRateLimitState(state: RateLimitState): void {
  localStorage.setItem('onedesk_rate_limit', JSON.stringify(state));
}

function checkRateLimit(): { blocked: boolean; remainingMs: number } {
  const state = getRateLimitState();
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    return { blocked: true, remainingMs: state.lockedUntil - Date.now() };
  }
  // Reset si le délai de blocage est passé
  if (state.lockedUntil && Date.now() >= state.lockedUntil) {
    saveRateLimitState({ attempts: 0, lockedUntil: null });
  }
  return { blocked: false, remainingMs: 0 };
}

function recordFailedAttempt(): { locked: boolean; remainingMs: number } {
  const state = getRateLimitState();
  const newAttempts = state.attempts + 1;
  if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    saveRateLimitState({ attempts: 0, lockedUntil });
    return { locked: true, remainingMs: LOCKOUT_DURATION_MS };
  }
  saveRateLimitState({ attempts: newAttempts, lockedUntil: null });
  return { locked: false, remainingMs: 0 };
}

function resetRateLimit(): void {
  saveRateLimitState({ attempts: 0, lockedUntil: null });
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Export de hashPassword pour permettre au seed démo de hasher les mots de passe
 * de la même manière que l'authStore. Garantit la cohérence des hashes.
 */
export { hashPassword as hashPasswordForSeed };

async function generateSessionToken(): Promise<{ token: string; tokenHash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const tokenHash = await computeSha256(token);
  return { token, tokenHash };
}

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

/**
 * Wipe des données cliniques locales au logout.
 *
 * SÉCURITÉ CRITIQUE (v1.2.0 production) :
 * Sans ce wipe, un poste médical partagé permettrait à un 2e utilisateur
 * de voir les données cliniques (patients, prescriptions, audit) du 1er
 * en se connectant avec son propre compte.
 *
 * Que wipe-t-on ?
 *  - patients, appointments, clinicalNotes, clinicalAddenda, medicationOrders
 *  - followUpTasks, secureConversations, secureMessages, breakGlassEvents
 *  - auditEvents, outboxItems
 *
 * Que conserve-t-on ?
 *  - localUsers (les comptes utilisateurs — sinon l'utilisateur suivant ne pourrait pas se connecter)
 *  - localSessions (historique des sessions, pour audit)
 *  - localLicenses (la licence du poste)
 */
async function wipeClinicalDataForSecurity(): Promise<void> {
  await Promise.all([
    db.patients.clear(),
    db.appointments.clear(),
    db.clinicalNotes.clear(),
    db.clinicalAddenda.clear(),
    db.medicationOrders.clear(),
    db.followUpTasks.clear(),
    db.secureConversations.clear(),
    db.secureMessages.clear(),
    db.breakGlassEvents.clear(),
    db.auditEvents.clear(),
    db.outboxItems.clear(),
  ]);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      tenantId: null,
      tenantName: null,
      activeBreakGlass: null,

      configureTenant: (tenantId, tenantName) => {
        set({ tenantId, tenantName });
      },

      login: async (username, password) => {
        set({ isLoading: true, error: null });

        // Rate limiting : vérifier si le compte est bloqué
        const rateLimit = checkRateLimit();
        if (rateLimit.blocked) {
          const minutesLeft = Math.ceil(rateLimit.remainingMs / 60000);
          const errorMsg = `Trop de tentatives échouées. Réessayez dans ${minutesLeft} minute(s).`;
          set({ isLoading: false, error: errorMsg });
          return { success: false, error: errorMsg };
        }

        try {
          // Pour le login local, on cherche par username SANS filtrer sur le tenant
          const user = await db.localUsers
            .where('username')
            .equals(username.toLowerCase())
            .first();

          if (!user || !user.isActive) {
            const { locked, remainingMs } = recordFailedAttempt();
            const errorMsg = locked
              ? `Trop de tentatives échouées. Compte bloqué pendant ${Math.ceil(remainingMs / 60000)} minutes.`
              : `Identifiants invalides. ${MAX_LOGIN_ATTEMPTS - getRateLimitState().attempts} tentative(s) restante(s).`;
            set({ isLoading: false, error: errorMsg });
            return { success: false, error: errorMsg };
          }

          const passwordHash = await hashPassword(password, user.salt);
          if (passwordHash !== user.passwordHash) {
            const { locked, remainingMs } = recordFailedAttempt();
            const errorMsg = locked
              ? `Trop de tentatives échouées. Compte bloqué pendant ${Math.ceil(remainingMs / 60000)} minutes.`
              : `Identifiants invalides. ${MAX_LOGIN_ATTEMPTS - getRateLimitState().attempts} tentative(s) restante(s).`;
            set({ isLoading: false, error: errorMsg });
            return { success: false, error: errorMsg };
          }

          // Login réussi → reset du rate limiting
          resetRateLimit();

          const { token, tokenHash } = await generateSessionToken();
          const expiresAt = new Date(
            Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000
          ).toISOString();

          const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

          await db.localSessions.add({
            id: sessionId,
            userId: user.id,
            tenantId: user.tenantId,
            tokenHash,
            expiresAt,
            createdAt: new Date().toISOString(),
            machineCode: localStorage.getItem('machine_code') || undefined,
          });

          await db.localUsers.update(user.id, { lastLoginAt: new Date().toISOString() });

          const appUser = localUserToAppUser(user);
          set({
            currentUser: appUser,
            session: { user: appUser, sessionId, tokenHash, expiresAt },
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          return { success: true };
        } catch (err) {
          set({ isLoading: false, error: 'Erreur technique d\'authentification.' });
          return { success: false, error: 'Erreur technique.' };
        }
      },

      loginWithSupabase: async (email, password) => {
        set({ isLoading: true, error: null });

        try {
          const { signInWithSupabase } = await import('../services/supabaseAuthService');
          const result = await signInWithSupabase(email, password);

          if (!result.success) {
            set({ isLoading: false, error: result.error || 'Échec de connexion.' });
            return {
              success: false,
              error: result.error,
              needsAdminActivation: result.needsAdminActivation,
              needsTenantAssignment: result.needsTenantAssignment,
            };
          }

          if (!result.user || !result.profile) {
            set({ isLoading: false, error: 'Profil utilisateur manquant.' });
            return { success: false, error: 'Profil utilisateur manquant.' };
          }

          // Configurer le tenant à partir du profil
          get().configureTenant(
            result.profile.tenantId,
            result.profile.tenantName || 'Clinique OneDesk'
          );

          // Créer une session locale (pour l'UI + break-glass + syncWorker)
          const { tokenHash } = await generateSessionToken();
          const expiresAt = new Date(
            Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000
          ).toISOString();
          const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

          await db.localSessions.add({
            id: sessionId,
            userId: result.user.id,
            tenantId: result.profile.tenantId,
            tokenHash,
            expiresAt,
            createdAt: new Date().toISOString(),
            machineCode: localStorage.getItem('machine_code') || undefined,
          });

          set({
            currentUser: result.user,
            session: {
              user: result.user,
              sessionId,
              tokenHash,
              expiresAt,
            },
            isAuthenticated: true,
            isLoading: false,
            error: null,
            tenantId: result.profile.tenantId,
            tenantName: result.profile.tenantName || 'Clinique OneDesk',
          });

          return { success: true };
        } catch (err) {
          set({ isLoading: false, error: 'Erreur technique Supabase Auth.' });
          return { success: false, error: 'Erreur technique.' };
        }
      },

      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });
        try {
          if (!get().tenantId) {
            return { success: false, error: 'Aucun tenant configuré.' };
          }
          // Import dynamique pour éviter dépendance circulaire
          const { signInWithGoogle } = await import('../services/googleAuthService');
          const result = await signInWithGoogle(get().tenantId!);

          if (result.isOffline) {
            set({ isLoading: false, error: result.error });
            return { success: false, isOffline: true, error: result.error };
          }
          if (!result.success) {
            // La redirection Google est en cours — on garde isLoading=true
            // jusqu'au retour de redirection
            if (result.error?.includes('Redirection')) {
              return { success: false, error: result.error };
            }
            set({ isLoading: false, error: result.error });
            return { success: false, error: result.error };
          }
          // Succès immédiat (rare avec signInWithOAuth, mais possible)
          if (result.user) {
            await get().completeGoogleLogin(result.user);
          }
          return { success: true };
        } catch (err) {
          set({ isLoading: false, error: 'Erreur Google OAuth.' });
          return { success: false, error: 'Erreur Google OAuth.' };
        }
      },

      completeGoogleLogin: async (user) => {
        const { tokenHash } = await generateSessionToken();
        const expiresAt = new Date(
          Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000
        ).toISOString();
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const tenantId = get().tenantId || 'unknown';

        await db.localSessions.add({
          id: sessionId,
          userId: user.id,
          tenantId,
          tokenHash,
          expiresAt,
          createdAt: new Date().toISOString(),
        });

        await db.localUsers.update(user.id, { lastLoginAt: new Date().toISOString() });

        set({
          currentUser: user,
          session: { user, sessionId, tokenHash, expiresAt },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      },

      logout: async () => {
        const { session } = get();
        if (session) {
          await db.localSessions.update(session.sessionId, {
            revokedAt: new Date().toISOString(),
          });
        }

        // Déconnecter aussi Supabase Auth (efface le JWT du localStorage)
        try {
          const { signOutSupabase } = await import('../services/supabaseAuthService');
          await signOutSupabase();
        } catch {
          // Silencieux : Supabase non configuré ou déjà déconnecté
        }

        // CRITIQUE (v1.2.0 production) : Wipe IndexedDB au logout.
        // Sans cela, un 2e utilisateur qui se connecte sur la même machine
        // verrait les données cliniques du précédent (patients, prescriptions, audit).
        // Pour un poste médical partagé, on doit garantir l'isolation par session.
        // Les localUsers (comptes) sont préservés ; seules les données cliniques
        // (patients, appointments, prescriptions, notes, audit, outbox, sync state)
        // sont effacées.
        try {
          await wipeClinicalDataForSecurity();
          console.info('[authStore] Données cliniques locales effacées au logout (isolation session).');
        } catch (err) {
          console.error('[authStore] Erreur wipe IndexedDB au logout:', err);
          // Non bloquant — on déconnecte quand même l'utilisateur
        }

        set({
          currentUser: null,
          session: null,
          isAuthenticated: false,
          activeBreakGlass: null,
          error: null,
        });
      },

      checkSession: async () => {
        const { session } = get();

        // Pas de session locale → essayer Supabase Auth (auto-reconnect)
        if (!session) {
          // Tenter de récupérer une session Supabase cachée (offline-first)
          try {
            const { getCurrentSupabaseSession } = await import('../services/supabaseAuthService');
            const result = await getCurrentSupabaseSession();
            if (result?.success && result.user && result.profile) {
              // Configurer le tenant + créer une session locale
              get().configureTenant(
                result.profile.tenantId,
                result.profile.tenantName || 'Clinique OneDesk'
              );
              const { tokenHash } = await generateSessionToken();
              const expiresAt = new Date(
                Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000
              ).toISOString();
              const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

              await db.localSessions.add({
                id: sessionId,
                userId: result.user.id,
                tenantId: result.profile.tenantId,
                tokenHash,
                expiresAt,
                createdAt: new Date().toISOString(),
              });

              set({
                currentUser: result.user,
                session: { user: result.user, sessionId, tokenHash, expiresAt },
                isAuthenticated: true,
                error: null,
                tenantId: result.profile.tenantId,
                tenantName: result.profile.tenantName || 'Clinique OneDesk',
              });
              return;
            }
          } catch {
            // Silencieux : Supabase non configuré ou session expirée
          }
          set({ isAuthenticated: false, currentUser: null });
          return;
        }

        // Session locale existante → vérifier expiration
        if (new Date(session.expiresAt) < new Date()) {
          await get().logout();
          set({ error: 'Session expirée. Veuillez vous reconnecter.' });
          return;
        }
        const dbSession = await db.localSessions.get(session.sessionId);
        if (!dbSession || dbSession.revokedAt) {
          set({
            currentUser: null,
            session: null,
            isAuthenticated: false,
            error: 'Session révoquée. Veuillez vous reconnecter.',
          });
        }
      },

      clearError: () => set({ error: null }),

      startBreakGlass: (patientId, justification) => {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + BREAK_GLASS_DURATION_MINUTES * 60 * 1000);
        set({
          activeBreakGlass: {
            patientId,
            justification,
            expiresAt: expiresAt.toISOString(),
            startedAt: now.toISOString(),
          },
        });
      },

      endBreakGlass: () => {
        set({ activeBreakGlass: null });
      },

      isBreakGlassActive: () => {
        const bg = get().activeBreakGlass;
        if (!bg) return false;
        return new Date(bg.expiresAt) > new Date();
      },
    }),
    {
      name: 'onedesk-auth',
      partialize: (state) => ({
        currentUser: state.currentUser,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
        tenantId: state.tenantId,
        tenantName: state.tenantName,
        activeBreakGlass: state.activeBreakGlass,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  setInterval(() => {
    const store = useAuthStore.getState();
    if (store.activeBreakGlass && !store.isBreakGlassActive()) {
      store.endBreakGlass();
    }
  }, 30_000);
}

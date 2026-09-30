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

        try {
          if (!get().tenantId) {
            return { success: false, error: 'Aucun tenant configuré. Contactez l\'administrateur.' };
          }
          const tenantId = get().tenantId!;

          const user = await db.localUsers
            .where('[tenantId+username]')
            .equals([tenantId, username.toLowerCase()])
            .first();

          if (!user || !user.isActive) {
            set({ isLoading: false, error: 'Identifiants invalides ou compte désactivé.' });
            return { success: false, error: 'Identifiants invalides.' };
          }

          const passwordHash = await hashPassword(password, user.salt);
          if (passwordHash !== user.passwordHash) {
            set({ isLoading: false, error: 'Identifiants invalides.' });
            return { success: false, error: 'Identifiants invalides.' };
          }

          const { token, tokenHash } = await generateSessionToken();
          const expiresAt = new Date(
            Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000
          ).toISOString();

          const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

          await db.localSessions.add({
            id: sessionId,
            userId: user.id,
            tenantId,
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

      logout: async () => {
        const { session } = get();
        if (session) {
          await db.localSessions.update(session.sessionId, {
            revokedAt: new Date().toISOString(),
          });
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
        if (!session) {
          set({ isAuthenticated: false, currentUser: null });
          return;
        }
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

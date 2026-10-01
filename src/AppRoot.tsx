import React, { useEffect, useState } from 'react';
import App from './App.tsx';
import { LoginScreen } from './components/auth/LoginScreen.tsx';
import { useAuthStore, hashPasswordForSeed } from './stores/authStore.ts';
import { db, LocalUser } from './services/localDatabase.ts';
import { startSyncWorker, stopSyncWorker } from './services/syncWorker.ts';
import { isSupabaseConfigured } from './services/supabaseClient.ts';
import { useLicenseStore } from './stores/licenseStore.ts';
import { LicenseActivationScreen } from './components/LicenseActivationScreen.tsx';

/**
 * AppRoot — Point d'entrée racine avec authentification obligatoire.
 *
 * Architecture :
 *  1. Au premier lancement, s'assure qu'un tenant démo + un médecin démo existent en base locale.
 *  2. Vérifie la session persistée (Zustand + localStorage).
 *  3. Si non authentifié → affiche <LoginScreen /> (remplace le <select> du Header).
 *  4. Si authentifié → affiche <App /> (l'existant, sans modification de comportement).
 *
 * Cette porte d'entrée garantit qu'aucune donnée clinique n'est visible sans authentification préalable,
 * et que la session expire automatiquement après 8h (configuré dans authStore).
 *
 * Non-régression : App.tsx conserve sa logique interne. Si l'utilisateur était déjà connecté
 * via l'ancien <select>, ce dernier continue de fonctionner dans App.tsx — mais l'accès initial
 * nécessite désormais une authentification réelle. En mode démo, le bouton "Connexion Dr. Nadia Martin"
 * crée automatiquement le compte et configure le tenant.
 */

// Comptes démo à créer si la base est vide (mode staging/preview)
const DEMO_TENANT_ID = 'demo-tenant-001';
const DEMO_TENANT_NAME = 'Clinique Démo OneDesk';

interface DemoUserSeed {
  id: string;
  username: string;
  displayName: string;
  role: LocalUser['role'];
  department: string;
  serviceCode: string;
  password: string; // Mot de passe en clair uniquement pour le seed, jamais stocké ainsi
  licenseNumber?: string;
}

const DEMO_USERS: DemoUserSeed[] = [
  {
    id: 'usr_nadia_martin',
    username: 'nadia.martin',
    displayName: 'Dr. Nadia Martin',
    role: 'doctor',
    department: 'Médecine Générale & Urgences',
    serviceCode: 'URG',
    password: 'demo',
    licenseNumber: '10003492811',
  },
];

/**
 * Crée le tenant démo + les utilisateurs démo si la base est vide.
 * Idempotent : ne recrée pas ce qui existe déjà.
 * En production, cette étape est remplacée par l'écran de configuration multi-tenant.
 */
async function ensureDemoSeed(): Promise<void> {
  // Configure le tenant démo
  const authState = useAuthStore.getState();
  if (!authState.tenantId) {
    authState.configureTenant(DEMO_TENANT_ID, DEMO_TENANT_NAME);
  }

  // Vérifie si des utilisateurs existent déjà
  const existingCount = await db.localUsers
    .where('tenantId')
    .equals(DEMO_TENANT_ID)
    .count();

  if (existingCount > 0) return;

  // Crée les utilisateurs démo avec mots de passe hashés (PBKDF2 via authStore.hashPassword)
  // Comme hashPassword est privé dans authStore, on utilise computeSha256 + salt pour le seed
  for (const seed of DEMO_USERS) {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    // IMPORTANT : on utilise exactement la même fonction de hashage que l'authStore.login
    // (PBKDF2 100k itérations). Sans cela, le hash stocké ne correspondrait jamais au hash
    // saisi lors du login.
    const passwordHash = await hashPasswordForSeed(seed.password, salt);

    const user: LocalUser = {
      id: seed.id,
      tenantId: DEMO_TENANT_ID,
      username: seed.username.toLowerCase(),
      displayName: seed.displayName,
      role: seed.role,
      department: seed.department,
      serviceCode: seed.serviceCode,
      licenseNumber: seed.licenseNumber,
      isActive: true,
      passwordHash,
      salt,
    };

    await db.localUsers.add(user);
  }
}

type AppRootStatus = 'initializing' | 'authenticated' | 'unauthenticated' | 'license_required';

export const AppRoot: React.FC = () => {
  const [status, setStatus] = useState<AppRootStatus>('initializing');
  const [initError, setInitError] = useState<string | null>(null);

  // Au montage : seed + vérification de session
  // NOTE: L'écran de licence n'est affiché QUE si la licence est révoquée (isReadOnly=true).
  // En mode démo (pas de licence), on passe directement au login.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1. Vérifier la licence (non bloquant en mode démo)
        await useLicenseStore.getState().verify();
        if (cancelled) return;

        const { license, isReadOnly } = useLicenseStore.getState();

        // Si licence révoquée → écran d'activation (mode lecture seule)
        // Mais en mode démo (pas de licence), on NE BLOQUE PAS — on va au login
        if (license?.status === 'revoked' || (isReadOnly && license)) {
          setStatus('license_required');
          return;
        }

        // 2. Seed + vérification session
        await ensureDemoSeed();
        if (cancelled) return;

        // Vérifie la session persistée
        await useAuthStore.getState().checkSession();
        if (cancelled) return;

        // Vérifie si on revient d'une redirection Google OAuth
        const { tenantId, isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated && tenantId) {
          try {
            const { handleGoogleRedirect } = await import('./services/googleAuthService');
            const result = await handleGoogleRedirect(tenantId);
            if (result.success && result.user) {
              await useAuthStore.getState().completeGoogleLogin(result.user);
              if (cancelled) return;
              setStatus('authenticated');
              return;
            }
          } catch {
            // Silencieux : pas de session Google active, c'est normal
          }
        }

        if (cancelled) return;
        const { isAuthenticated: stillAuth } = useAuthStore.getState();
        setStatus(stillAuth ? 'authenticated' : 'unauthenticated');
      } catch (err) {
        console.error('[AppRoot] Initialization failed:', err);
        if (!cancelled) {
          setInitError(
            err instanceof Error ? err.message : 'Erreur inconnue d\'initialisation'
          );
          setStatus('unauthenticated');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Souscrit aux changements d'authentification + démarre le syncWorker
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      const newStatus = state.isAuthenticated ? 'authenticated' : 'unauthenticated';
      setStatus(newStatus);

      // Démarre le syncWorker quand l'utilisateur s'authentifie (si Supabase est configuré)
      if (newStatus === 'authenticated' && state.tenantId) {
        if (isSupabaseConfigured()) {
          startSyncWorker(state.tenantId);
        }
      } else {
        // Arrête le syncWorker à la déconnexion
        stopSyncWorker();
      }
    });
    return unsub;
  }, []);

  // Démarre aussi le syncWorker au montage si déjà authentifié (session persistée)
  useEffect(() => {
    const { isAuthenticated, tenantId } = useAuthStore.getState();
    if (isAuthenticated && tenantId && isSupabaseConfigured()) {
      startSyncWorker(tenantId);
    }
    return () => {
      stopSyncWorker();
    };
  }, []);

  // Écran d'initialisation (très bref — quelques ms)
  if (status === 'initializing') {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Initialisation du poste clinique…
          </p>
        </div>
      </div>
    );
  }

  // Écran d'erreur fatale
  if (initError && status === 'unauthenticated') {
    // On n'affiche l'erreur que si elle est critique (initialization vraiment échouée)
    // Mais on laisse quand même l'écran de login pour permettre une reprise
    console.warn('[AppRoot] Initialization error (non-blocking):', initError);
  }

  // Licence requise → écran d'activation
  if (status === 'license_required') {
    return <LicenseActivationScreen />;
  }

  // Non authentifié → écran de login
  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }

  // Authentifié → application principale
  return <App />;
};

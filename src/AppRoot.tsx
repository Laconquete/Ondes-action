import React, { useEffect, useState } from 'react';
import App from './App.tsx';
import { LoginScreen } from './components/auth/LoginScreen.tsx';
import { useAuthStore, hashPasswordForSeed } from './stores/authStore.ts';
import { db, LocalUser } from './services/localDatabase.ts';

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

type AppRootStatus = 'initializing' | 'authenticated' | 'unauthenticated';

export const AppRoot: React.FC = () => {
  const [status, setStatus] = useState<AppRootStatus>('initializing');
  const [initError, setInitError] = useState<string | null>(null);

  // Au montage : seed + vérification de session
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await ensureDemoSeed();
        if (cancelled) return;

        // Vérifie la session persistée
        await useAuthStore.getState().checkSession();
        if (cancelled) return;

        const { isAuthenticated } = useAuthStore.getState();
        setStatus(isAuthenticated ? 'authenticated' : 'unauthenticated');
      } catch (err) {
        console.error('[AppRoot] Initialization failed:', err);
        if (!cancelled) {
          setInitError(
            err instanceof Error ? err.message : 'Erreur inconnue d\'initialisation'
          );
          // En cas d'erreur, on bascule en mode non-authentifié plutôt que de planter
          setStatus('unauthenticated');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Souscrit aux changements d'authentification
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      setStatus(state.isAuthenticated ? 'authenticated' : 'unauthenticated');
    });
    return unsub;
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

  // Non authentifié → écran de login
  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }

  // Authentifié → application principale
  return <App />;
};

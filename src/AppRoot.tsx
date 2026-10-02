import React, { useEffect, useState } from 'react';
import App from './App.tsx';
import { LoginScreen } from './components/auth/LoginScreen.tsx';
import { SetupWizard } from './components/SetupWizard.tsx';
import { useAuthStore } from './stores/authStore.ts';
import { startSyncWorker, stopSyncWorker } from './services/syncWorker.ts';
import { isSupabaseConfigured, preloadSupabaseFromConfig, resetSupabaseClient } from './services/supabaseClient.ts';
import { isAppConfigured, clearAppConfig } from './services/appConfig.ts';
import { useLicenseStore } from './stores/licenseStore.ts';
import { LicenseActivationScreen } from './components/LicenseActivationScreen.tsx';

/**
 * AppRoot — Point d'entrée racine v1.2.0 (production)
 *
 * Workflow au démarrage :
 *  1. Vérifier la licence (non bloquant en mode essai 7 jours)
 *  2. Vérifier si l'app est configurée (appConfig.isConfigured())
 *     → Si NON : afficher <SetupWizard /> (saisie URL Supabase, anon key, Google OAuth, tenant)
 *  3. Pré-charger le client Supabase depuis la config chiffrée (preloadSupabaseFromConfig)
 *  4. Vérifier la session persistée
 *  5. Si non authentifié → <LoginScreen /> (avec bouton "Reconfigurer le backend")
 *  6. Si authentifié → <App />
 *
 * Sécurité v1.2.0 :
 *  - Aucun seed démo (retrait ensureDemoUserExists)
 *  - Wipe IndexedDB au logout (isolation par session, voir authStore.logout)
 *  - Configuration backend chiffrée AES-GCM (clé dérivée du code machine + licence)
 */

type AppRootStatus =
  | 'initializing'
  | 'setup_required'
  | 'authenticated'
  | 'unauthenticated'
  | 'license_required';

export const AppRoot: React.FC = () => {
  const [status, setStatus] = useState<AppRootStatus>('initializing');
  const [initError, setInitError] = useState<string | null>(null);

  // Initialisation au montage
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1. Vérifier la licence (non bloquant en mode essai)
        await useLicenseStore.getState().verify();
        if (cancelled) return;

        const { license, isReadOnly } = useLicenseStore.getState();
        if (license?.status === 'revoked' || (isReadOnly && license)) {
          setStatus('license_required');
          return;
        }

        // 2. Vérifier si l'app est configurée
        if (!isAppConfigured()) {
          // Premier lancement — afficher le SetupWizard
          setStatus('setup_required');
          return;
        }

        // 3. Pré-charger le client Supabase depuis la config chiffrée
        await preloadSupabaseFromConfig();
        if (cancelled) return;

        // 4. Vérifier la session persistée
        await useAuthStore.getState().checkSession();
        if (cancelled) return;

        // 5. Vérifier si on revient d'une redirection Google OAuth
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

  // Écran d'initialisation
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

  // Écran d'erreur fatale (non bloquant — on laisse l'écran de login)
  if (initError && status === 'unauthenticated') {
    console.warn('[AppRoot] Initialization error (non-blocking):', initError);
  }

  // Licence requise → écran d'activation
  if (status === 'license_required') {
    return <LicenseActivationScreen />;
  }

  // Setup requis → écran de configuration
  if (status === 'setup_required') {
    return (
      <SetupWizard
        onCompleted={async () => {
          // Après sauvegarde de la config :
          // 1. Recharger le client Supabase
          resetSupabaseClient();
          await preloadSupabaseFromConfig();
          // 2. Passer à l'écran de login
          setStatus('unauthenticated');
        }}
      />
    );
  }

  // Non authentifié → écran de login
  if (status === 'unauthenticated') {
    return (
      <LoginScreen
        onResetConfig={() => {
          // Bouton "Reconfigurer le backend"
          clearAppConfig();
          resetSupabaseClient();
          setStatus('setup_required');
        }}
      />
    );
  }

  // Authentifié → application principale
  return <App />;
};

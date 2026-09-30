import React, { useState, useEffect } from 'react';
import {
  Lock,
  User as UserIcon,
  Stethoscope,
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { db, LocalUser } from '../../services/localDatabase';
import { computeSha256 } from '../../services/cryptoAuditService';
import { isGoogleAuthAvailable } from '../../services/googleAuthService';

/**
 * Écran de connexion sécurisé — remplace le `<select>` du Header
 *
 * Fonctionnalités :
 *  - Saisie username + mot de passe (PBKDF2 + salt, 100k itérations)
 *  - Bouton "Afficher/Masquer le mot de passe"
 *  - Affichage des erreurs inline + toast
 *  - Indication visuelle de la sécurité (lock icon)
 *  - Pré-configuration du tenant (multi-tenant) si pas déjà faite
 *  - Démo : si aucun utilisateur n'existe en base, on crée un médecin de démo
 *
 * Le flux d'authentification est 100% offline-capable :
 *  - Vérification du hash en local (IndexedDB via Dexie)
 *  - Création d'une session signée en local
 *  - Pas de dépendance réseau
 */

// Démo : création d'un compte médecin local si la base est vide
async function ensureDemoUserExists(): Promise<void> {
  const existing = await db.localUsers.count();
  if (existing > 0) return;

  const salt = Math.random().toString(36).substring(2, 12);
  const passwordHash = await computeSha256(`demo${salt}`); // Hash du mot de passe "demo"

  const demoUser: LocalUser = {
    id: 'usr_nadia_martin',
    tenantId: 'demo-tenant-001',
    username: 'nadia.martin',
    displayName: 'Dr. Nadia Martin',
    role: 'doctor',
    department: 'Médecine Générale & Urgences',
    serviceCode: 'URG',
    licenseNumber: '10003492811',
    rppsCode: '10003492811',
    isActive: true,
    passwordHash,
    salt,
  };

  await db.localUsers.add(demoUser);

  // Configure le tenant démo automatiquement
  useAuthStore.getState().configureTenant('demo-tenant-001', 'Clinique Démo OneDesk');
}

export const LoginScreen: React.FC = () => {
  const { login, loginWithSupabase, loginWithGoogle, isLoading, error, clearError, tenantId, tenantName, configureTenant } = useAuthStore();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showTenantConfig, setShowTenantConfig] = useState(false);
  const [newTenantId, setNewTenantId] = useState('');
  const [initError, setInitError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Détermine le mode d'authentification : Supabase (email) ou Local (username)
  const useSupabaseAuth = isGoogleAuthAvailable(); // = Supabase configuré + online

  // Initialisation au premier rendu : s'assurer qu'un utilisateur de démo existe
  useEffect(() => {
    (async () => {
      try {
        await ensureDemoUserExists();
        setIsReady(true);
      } catch (err) {
        setInitError('Erreur d\'initialisation de la base locale. Rechargez la page.');
        console.error(err);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = (useSupabaseAuth ? email : username).trim();
    if (!identifier || !password) {
      toast.warning('Champs requis', 'Veuillez saisir votre identifiant et mot de passe.');
      return;
    }
    const result = useSupabaseAuth
      ? await loginWithSupabase(identifier, password)
      : await login(identifier, password);

    if (result.success) {
      toast.success('Connexion réussie', `Bienvenue, ${useAuthStore.getState().currentUser?.displayName}.`);
    } else if (result.error) {
      if (result.error.includes('network') || result.error.includes('Réseau')) {
        toast.warning('Hors-ligne', 'Basculez sur l\'authentification locale ci-dessous.');
      } else {
        toast.error('Échec de connexion', result.error);
      }
    }
  };

  const handleDemoLogin = async () => {
    setUsername('nadia.martin');
    setPassword('demo');
    // Petite latence pour laisser le state se propager
    setTimeout(async () => {
      const result = await login('nadia.martin', 'demo');
      if (result.success) {
        toast.success('Connexion démo', 'Vous êtes connecté en tant que Dr. Nadia Martin.');
      }
    }, 100);
  };

  const handleGoogleLogin = async () => {
    const result = await loginWithGoogle();
    if (result.isOffline) {
      toast.warning(
        'Réseau indisponible',
        'Google OAuth nécessite une connexion. Utilisez l\'authentification locale ci-dessous.'
      );
    } else if (!result.success && result.error && !result.error.includes('Redirection')) {
      toast.error('Google OAuth', result.error);
    }
    // Si "Redirection vers Google en cours" — ne pas afficher d'erreur, le navigateur va rediriger
  };

  const handleTenantConfig = () => {
    if (newTenantId.trim()) {
      configureTenant(newTenantId.trim(), `Tenant ${newTenantId.trim()}`);
      setShowTenantConfig(false);
      toast.success('Tenant configuré', `Tenant ${newTenantId} activé.`);
    }
  };

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-red-900 dark:text-red-100 mb-1">
            Erreur d'initialisation
          </h2>
          <p className="text-xs text-red-700 dark:text-red-300">{initError}</p>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 animate-fadeIn">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 bg-blue-600 text-white shadow-xl shadow-blue-500/20 mb-4">
            <Stethoscope className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            NetPhar<span className="text-blue-600">+</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Poste de travail clinique sécurisé · HDS
          </p>
        </div>

        {/* Carte de connexion */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-clinical-lg p-7 animate-fadeInScale">
          {/* Indicateur de tenant */}
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400">Établissement :</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {tenantName || 'Non configuré'}
              </span>
            </div>
            <button
              onClick={() => setShowTenantConfig(!showTenantConfig)}
              className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
            >
              {showTenantConfig ? 'Annuler' : 'Changer'}
            </button>
          </div>

          {/* Configuration du tenant (multi-tenant) */}
          {showTenantConfig && (
            <div className="mb-5 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 animate-fadeIn">
              <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-100 mb-1.5">
                Identifiant du tenant
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTenantId}
                  onChange={(e) => setNewTenantId(e.target.value)}
                  placeholder="ex: clinique-saint-luc"
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleTenantConfig}
                  className="px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  OK
                </button>
              </div>
              <p className="text-[10px] text-blue-700 dark:text-blue-300 mt-1.5">
                Le tenant est fourni par l'administrateur après activation de la licence.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email ou Identifiant selon le mode d'auth */}
            <div>
              <label htmlFor="login-identifier" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                {useSupabaseAuth ? 'Email professionnel' : 'Identifiant'}
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="login-identifier"
                  type={useSupabaseAuth ? 'email' : 'text'}
                  value={useSupabaseAuth ? email : username}
                  onChange={(e) => {
                    if (useSupabaseAuth) setEmail(e.target.value);
                    else setUsername(e.target.value);
                    if (error) clearError();
                  }}
                  autoComplete={useSupabaseAuth ? 'email' : 'username'}
                  className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder={useSupabaseAuth ? 'dr.martin@clinique.fr' : 'prénom.nom'}
                  required
                />
              </div>
              {useSupabaseAuth && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Authentification sécurisée via Supabase Auth (RLS native)
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) clearError();
                  }}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div className="flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 animate-fadeIn">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white py-2.5 text-sm font-bold shadow-md shadow-blue-500/10 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion en cours…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Se connecter
                </>
              )}
            </button>
          </form>

          {/* Séparateur + Google OAuth */}
          {isGoogleAuthAvailable() && (
            <>
              <div className="flex items-center gap-3 mt-4 mb-4">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span className="text-[10px] text-slate-400 dark:text-slate-600 uppercase tracking-wider font-semibold">
                  ou
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-2.5 text-sm font-bold transition-all"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continuer avec Google
              </button>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center leading-relaxed">
                Second facteur optionnel — préserve l'authentification locale hors-ligne
              </p>
            </>
          )}

          {/* Démo */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              Mode démonstration
            </p>
            <button
              onClick={handleDemoLogin}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
            >
              Connexion en tant que Dr. Nadia Martin (démo)
            </button>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
              Identifiants démo : <code className="font-mono">nadia.martin</code> / <code className="font-mono">demo</code>
            </p>
          </div>
        </div>

        {/* Pied de page sécurité */}
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-6 leading-relaxed">
          🔒 Authentification chiffrée (PBKDF2 + Web Crypto) · Session 8h · Données chiffrées en local (IndexedDB)
        </p>
      </div>
    </div>
  );
};

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
import { useAuthStore, hashPasswordForSeed } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { db, LocalUser } from '../../services/localDatabase';
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

// Démo : création des comptes locaux multi-rôles (médecin, infirmière, réceptionniste)
const DEMO_USERS_SEED: Array<{
  id: string;
  username: string;
  displayName: string;
  role: string;
  department: string;
  serviceCode: string;
}> = [
  {
    id: 'usr_nadia_mukendi',
    username: 'dr.mukendi',
    displayName: 'Dr. Nadia Mukendi',
    role: 'doctor',
    department: 'Médecine Générale & Urgences',
    serviceCode: 'MED-GEN',
  },
  {
    id: 'usr_marc_tshibangu',
    username: 'dr.tshibangu',
    displayName: 'Dr. Marc Tshibangu',
    role: 'doctor',
    department: 'Cardiologie',
    serviceCode: 'CARDIO',
  },
  {
    id: 'usr_esther_mbuyi',
    username: 'inf.mbuyi',
    displayName: 'Esther Mbuyi (IDE)',
    role: 'nurse',
    department: 'Soins & Consultations',
    serviceCode: 'SOINS',
  },
  {
    id: 'usr_patrick_kalala',
    username: 'acc.kalala',
    displayName: 'Patrick Kalala',
    role: 'receptionist',
    department: 'Accueil & Admission',
    serviceCode: 'ACCUEIL',
  },
  {
    id: 'usr_fabrice_admin',
    username: 'admin.fabrice',
    displayName: 'Fabricefb (Admin)',
    role: 'admin',
    department: 'Direction Générale',
    serviceCode: 'ADMIN',
  },
];

async function ensureDemoUserExists(): Promise<void> {
  // Configurer le tenant démo
  useAuthStore.getState().configureTenant('demo-tenant-001', 'Clinique Démo OneDesk');

  // Créer tous les users démo s'ils n'existent pas
  for (const seed of DEMO_USERS_SEED) {
    const existing = await db.localUsers
      .where('username')
      .equals(seed.username)
      .first();

    if (existing) continue;

    const salt = Math.random().toString(36).substring(2, 12);
    const passwordHash = await hashPasswordForSeed('demo', salt);

    const demoUser: LocalUser = {
      id: seed.id,
      tenantId: 'demo-tenant-001',
      username: seed.username,
      displayName: seed.displayName,
      role: seed.role,
      department: seed.department,
      serviceCode: seed.serviceCode,
      isActive: true,
      passwordHash,
      salt,
    };

    await db.localUsers.put(demoUser);
  }
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
      } else if (result.error.includes('invalides') || result.error.includes('incorrect')) {
        // Si Supabase Auth échoue (pas encore d'utilisateurs créés), suggérer le mode démo
        toast.error('Échec de connexion', 'Identifiants Supabase invalides. Utilisez le bouton "Connexion démo" ci-dessous ou créez l\'utilisateur dans Supabase Dashboard.');
      } else {
        toast.error('Échec de connexion', result.error);
      }
    }
  };

  const handleDemoLogin = async (username?: string) => {
    const targetUsername = username || 'dr.mukendi';
    // Garantir que les utilisateurs démo existent
    await ensureDemoUserExists();

    // Configurer le tenant démo
    useAuthStore.getState().configureTenant('demo-tenant-001', 'Clinique Démo OneDesk');

    // Tenter le login avec l'auth locale
    const result = await login(targetUsername, 'demo');
    if (result.success) {
      const user = useAuthStore.getState().currentUser;
      toast.success('Connexion démo', `Bienvenue, ${user?.displayName || targetUsername}`);
    } else {
      // Retry : supprimer et recréer le user
      const seed = DEMO_USERS_SEED.find((s) => s.username === targetUsername);
      if (seed) {
        await db.localUsers.delete(seed.id);
        await ensureDemoUserExists();
        const retry = await login(targetUsername, 'demo');
        if (retry.success) {
          const user = useAuthStore.getState().currentUser;
          toast.success('Connexion démo', `Bienvenue, ${user?.displayName || targetUsername}`);
        } else {
          toast.error('Erreur démo', 'Impossible de se connecter. Rechargez la page.');
        }
      }
    }
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
        {/* Branding — favicon compact + nom OneDesk */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-2">
            <img
              src="/logo-FOAVICON .png"
              alt="OneDesk Clinique"
              className="h-16 w-16 sm:h-20 sm:w-20 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            OneDesk
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Poste de travail clinique sécurisé
          </p>
        </div>

        {/* Carte de connexion */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-clinical-lg p-7 animate-fadeInScale">
          {/* Indicateur de tenant — masqué en mode démo (Supabase non configuré) */}
          {useSupabaseAuth && (
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
          )}

          {/* Configuration du tenant (multi-tenant) — masquée en démo */}
          {useSupabaseAuth && showTenantConfig && (
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

          {/* Démo multi-rôles — TOUJOURS visible */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider text-center">
              {useSupabaseAuth ? 'Essai en mode démo (multi-rôles)' : 'Mode démonstration — multi-rôles'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDemoLogin('dr.mukendi')}
                className="flex items-center justify-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-2 text-[10px] font-bold border border-blue-200 dark:border-blue-800 transition-colors"
              >
                🩺 Dr. Mukendi
              </button>
              <button
                onClick={() => handleDemoLogin('dr.tshibangu')}
                className="flex items-center justify-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-2 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800 transition-colors"
              >
                💓 Dr. Tshibangu
              </button>
              <button
                onClick={() => handleDemoLogin('inf.mbuyi')}
                className="flex items-center justify-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2.5 py-2 text-[10px] font-bold border border-rose-200 dark:border-rose-800 transition-colors"
              >
                💉 Infirmière Mbuyi
              </button>
              <button
                onClick={() => handleDemoLogin('acc.kalala')}
                className="flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-2 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 transition-colors"
              >
                🏥 Accueil Kalala
              </button>
              <button
                onClick={() => handleDemoLogin('admin.fabrice')}
                className="flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 px-2.5 py-2 text-[10px] font-bold border border-red-200 dark:border-red-800 transition-colors"
              >
                🛡️ Admin Fabricefb
              </button>
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 text-center">
              Mot de passe démo : <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1">demo</code> — Noms congolais
            </p>
            {useSupabaseAuth && (
              <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-1.5 text-center leading-relaxed">
                ⚠ Pas d'utilisateurs Supabase ? Utilisez un bouton démo ci-dessus.
              </p>
            )}
          </div>
        </div>

        {/* Pied de page sécurité */}
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-6 leading-relaxed">
          🔒 Authentification chiffrée (PBKDF2 + Web Crypto) · Session 8h · Données chiffrées en local (IndexedDB)
        </p>

        {/* Contact commercial — passage en version Pro */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
            Vous voulez utiliser OneDesk dans votre établissement ?
          </p>
          <a
            href="https://wa.me/243999071754?text=Bonjour%2C%20je%20suis%20intéressé%20par%20OneDesk%20Clinique%20pour%20mon%20établissement"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white px-4 py-2 text-xs font-bold transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Demander une démo Pro
          </a>
          <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-1.5">
            Fabricefb · By MyEventprod · +243 999 071 754
          </p>
        </div>
      </div>
    </div>
  );
};

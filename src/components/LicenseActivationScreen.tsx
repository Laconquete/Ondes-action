import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  Loader2,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { useLicenseStore, generateWebMachineCode } from '../stores/licenseStore';
import { toast } from '../stores/toastStore';

/**
 * LicenseActivationScreen — Écran de configuration au 1er lancement.
 *
 * Affiché quand :
 *  - Pas de licence activée
 *  - OU licence expirée/révoquée
 *
 * Permet à l'utilisateur de :
 *  1. Saisir sa clé de licence (NPX-XXXX-XXXX-XXXX-XXXX)
 *  2. Démarrer un essai gratuit de 7 jours
 *
 * Le machine code est affiché (pour que l'admin puisse le lier à la licence).
 */
export const LicenseActivationScreen: React.FC = () => {
  const { activate, startTrial, error, isReadOnly } = useLicenseStore();
  const [keyCode, setKeyCode] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [machineCode, setMachineCode] = useState('');

  useEffect(() => {
    // Récupérer le machine code (Electron preload ou simulé web)
    const code = (window as unknown as { getMachineCode?: () => string }).getMachineCode?.() || generateWebMachineCode();
    setMachineCode(code);
  }, []);

  const handleActivate = async () => {
    if (!keyCode.trim()) {
      toast.warning('Clé requise', 'Veuillez saisir votre clé de licence.');
      return;
    }
    setIsLoading(true);
    const result = await activate(keyCode.trim().toUpperCase(), machineCode, tenantName.trim() || undefined);
    setIsLoading(false);
    if (result.success) {
      toast.success('Licence activée', 'Bienvenue dans OneDesk Clinique !');
    } else {
      toast.error("Échec d'activation", result.error || 'Clé de licence invalide.');
    }
  };

  const handleTrial = () => {
    startTrial();
    toast.info('Essai démarré', 'Vous disposez de 7 jours pour tester OneDesk.');
  };

  // Si licence expirée/révoquée → mode lecture seule
  if (isReadOnly) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 animate-fadeIn">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <img src="/logo-FOAVICON .png" alt="OneDesk" className="h-16 w-16 mx-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 shadow-clinical-lg p-7">
            <div className="flex items-center justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center bg-amber-100 dark:bg-amber-950/60 border-2 border-amber-400">
                <AlertTriangle className="h-7 w-7 text-amber-600" />
              </div>
            </div>
            <h2 className="text-center text-sm font-bold text-amber-900 dark:text-amber-100 mb-2">
              Licence expirée ou révoquée
            </h2>
            <p className="text-center text-xs text-slate-600 dark:text-slate-400 mb-4">
              {error || "Votre licence n'est plus valide. L'application est en mode lecture seule."}
            </p>
            <p className="text-center text-[10px] text-slate-400 mb-4">
              Vos données sont conservées et consultables, mais les nouvelles saisies sont bloquées.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold"
            >
              Réessayer la vérification
            </button>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-[10px] text-slate-500 mb-2">Pour renouveler votre licence :</p>
              <a
                href="https://wa.me/243999071754?text=Bonjour%2C%20je%20veux%20renouveler%20ma%20licence%20OneDesk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white px-4 py-2 text-xs font-bold"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Renouveler via WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 animate-fadeIn">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src="/logo-FOAVICON .png" alt="OneDesk Clinique" className="h-16 w-16 sm:h-20 sm:w-20 mx-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Poste de travail clinique sécurisé</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-clinical-lg p-7 animate-fadeInScale">
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center h-12 w-12 bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 mb-3">
              <KeyRound className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Activation de OneDesk
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Saisissez votre clé de licence pour activer l'application
            </p>
          </div>

          {/* Machine code (lecture seule) */}
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Identifiant machine
            </label>
            <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all">{machineCode}</p>
            <p className="text-[9px] text-slate-400 mt-1">Communiquez cet identifiant à votre fournisseur pour lier la licence</p>
          </div>

          {/* Clé de licence */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Clé de licence
            </label>
            <input
              type="text"
              value={keyCode}
              onChange={(e) => setKeyCode(e.target.value.toUpperCase())}
              placeholder="NPX-XXXX-XXXX-XXXX-XXXX"
              className="w-full px-3 py-2.5 text-sm font-mono text-center border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none tracking-wider"
              maxLength={24}
              autoFocus
            />
          </div>

          {/* Nom de l'établissement */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Nom de l'établissement (optionnel)
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="ex: Clinique Saint-Luc"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="mb-4 flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Bouton activer */}
          <button
            onClick={handleActivate}
            disabled={isLoading || !keyCode.trim()}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 text-sm font-bold transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Activation...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Activer la licence
              </>
            )}
          </button>

          {/* Séparateur */}
          <div className="flex items-center gap-3 mt-5 mb-5">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Essai gratuit */}
          <button
            onClick={handleTrial}
            className="w-full flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 text-sm font-bold transition-colors"
          >
            <Clock className="h-4 w-4 text-amber-500" />
            Démarrer un essai gratuit (7 jours)
          </button>
          <p className="text-center text-[10px] text-slate-400 mt-2">
            Testez toutes les fonctionnalités sans engagement
          </p>
        </div>

        {/* Contact commercial */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
            Vous n'avez pas de clé de licence ?
          </p>
          <a
            href="https://wa.me/243999071754?text=Bonjour%2C%20je%20suis%20intéressé%20par%20OneDesk%20Clinique"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white px-4 py-2 text-xs font-bold transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Demander une licence
          </a>
          <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-1.5">
            Fabricefb · By MyEventprod · +243 999 071 754
          </p>
        </div>
      </div>
    </div>
  );
};

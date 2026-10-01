import React from 'react';
import {
  Stethoscope,
  Users,
  Calendar,
  Activity,
  MessageSquare,
  Shield,
  Download,
  X,
  LogOut,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

type TabId = 'portal' | 'workspace' | 'schedule' | 'patients' | 'followups' | 'messaging' | 'audit' | 'nursing';

interface BottomNavBarProps {
  activeTab: string;
  onTabChange: (tab: TabId) => void;
  canViewClinical: boolean;
  currentUserDisplayName?: string;
  onLogout?: () => void;
}

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType; color: string }> = [
  { id: 'portal', label: 'Portail', icon: Stethoscope, color: 'text-blue-600 dark:text-blue-400' },
  { id: 'patients', label: 'Patients', icon: Users, color: 'text-teal-600 dark:text-teal-400' },
  { id: 'schedule', label: 'Agenda', icon: Calendar, color: 'text-indigo-600 dark:text-indigo-400' },
  { id: 'nursing', label: 'Soins', icon: Activity, color: 'text-rose-600 dark:text-rose-400' },
  { id: 'messaging', label: 'Messages', icon: MessageSquare, color: 'text-purple-600 dark:text-purple-400' },
];

const MORE_TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: 'workspace', label: 'Poste Médecin', icon: Stethoscope },
  { id: 'followups', label: 'Suivis', icon: Activity },
  { id: 'audit', label: 'Audit HDS', icon: Shield },
];

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  canViewClinical,
  currentUserDisplayName = '',
  onLogout,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showMore, setShowMore] = React.useState(false);
  const [showIOSHint, setShowIOSHint] = React.useState(false);
  const [showProfile, setShowProfile] = React.useState(false);
  const [showInstallHint, setShowInstallHint] = React.useState(false);

  // Afficher l'info-bulle d'installation 3 secondes après le chargement
  // (seulement si installable et pas déjà installé)
  React.useEffect(() => {
    if ((isInstallable || isIOS) && !isInstalled) {
      const dismissed = sessionStorage.getItem('pwa_hint_dismissed');
      if (!dismissed) {
        const timer = setTimeout(() => setShowInstallHint(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [isInstallable, isIOS, isInstalled]);

  const dismissInstallHint = () => {
    setShowInstallHint(false);
    sessionStorage.setItem('pwa_hint_dismissed', '1');
  };

  const initials = currentUserDisplayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Réceptionniste : ne voit QUE l'agenda (qui contient le Reception Dashboard)
  // Pas d'accès clinique = pas de Portail, Patients, Soins, Messages
  const visibleTabs = canViewClinical
    ? TABS
    : TABS.filter((t) => t.id === 'schedule');

  return (
    <>
      {/* Barre de navigation inférieure — visible uniquement sur < xl */}
      <nav
        className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
          {/* Onglets principaux */}
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 transition-colors ${
                  isActive ? tab.color : 'text-slate-400 dark:text-slate-600'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                <span className={`text-[9px] font-bold ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <span className={`absolute -top-px h-0.5 w-8 ${tab.color.replace('text-', 'bg-')}`} />
                )}
              </button>
            );
          })}

          {/* Bouton "Plus" */}
          {canViewClinical && (
            <button
              onClick={() => setShowMore(true)}
              className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-slate-400 dark:text-slate-600"
            >
              <div className="flex gap-0.5">
                <span className="h-1 w-1 rounded-full bg-current" />
                <span className="h-1 w-1 rounded-full bg-current" />
                <span className="h-1 w-1 rounded-full bg-current" />
              </div>
              <span className="text-[9px] font-medium">Plus</span>
            </button>
          )}

          {/* Bouton Profil/Déconnexion — initiales cliquables */}
          <button
            onClick={() => setShowProfile(true)}
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-slate-500 dark:text-slate-400"
            title="Profil & Déconnexion"
          >
            <div className="flex h-6 w-6 items-center justify-center bg-blue-600 text-white font-bold text-[9px]">
              {initials || '••'}
            </div>
            <span className="text-[9px] font-medium">Profil</span>
          </button>
        </div>
      </nav>

      {/* Info-bulle d'installation PWA (toast non-bloquant, auto-dismiss) */}
      {showInstallHint && (
        <div
          className="xl:hidden fixed bottom-16 left-2 right-2 z-50 bg-blue-600 text-white p-3 shadow-2xl animate-fadeInUp rounded-lg flex items-center gap-3"
          onClick={() => dismissInstallHint()}
        >
          <Download className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold">Installer OneDesk sur votre téléphone</p>
            <p className="text-[10px] opacity-90">Accédez à l'app sans navigateur, comme une vraie application</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isIOS) setShowIOSHint(true);
              else void install();
              dismissInstallHint();
            }}
            className="bg-white text-blue-600 px-3 py-1.5 text-xs font-bold shrink-0"
          >
            Installer
          </button>
          <button onClick={(e) => { e.stopPropagation(); dismissInstallHint(); }} className="text-white/70 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Menu Profil (mobile) */}
      {showProfile && (
        <div
          className="xl:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setShowProfile(false)}
        >
          <div
            className="absolute bottom-14 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-2xl p-4 animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Mon profil
              </h3>
              <button
                onClick={() => setShowProfile(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="text-center py-4">
              <div className="flex h-12 w-12 mx-auto items-center justify-center bg-blue-600 text-white font-bold text-sm mb-2">
                {initials || '••'}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Connecté en tant que
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {currentUserDisplayName || 'Utilisateur'}
              </p>
              <button
                onClick={() => { onLogout?.(); setShowProfile(false); }}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2.5 text-xs font-bold transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu "Plus" — overlay */}
      {showMore && (
        <div
          className="xl:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setShowMore(false)}
        >
          <div
            className="absolute bottom-14 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-2xl p-4 animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Plus d'options
              </h3>
              <button
                onClick={() => setShowMore(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MORE_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      setShowMore(false);
                    }}
                    className={`flex flex-col items-center gap-1.5 p-3 border transition-colors ${
                      isActive
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-bold">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* iOS Installation Hint */}
      {showIOSHint && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          onClick={() => setShowIOSHint(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 max-w-xs animate-fadeInScale"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <Download className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Installer OneDesk
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
              Pour installer OneDesk sur votre iPhone/iPad :
            </p>
            <ol className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5 mb-4">
              <li>1. Appuyez sur le bouton <strong>Partager</strong> (carré avec flèche ↑)</li>
              <li>2. Sélectionnez <strong>« Sur l'écran d'accueil »</strong></li>
              <li>3. Appuyez sur <strong>« Ajouter »</strong></li>
            </ol>
            <button
              onClick={() => setShowIOSHint(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 text-xs font-bold transition-colors"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};

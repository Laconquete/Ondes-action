import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertOctagon,
  Calendar,
  Clock,
  Download,
  FileText,
  Lock,
  MessageSquare,
  Search,
  Shield,
  ShieldAlert,
  User,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  ChevronDown,
  Building2,
  CheckCircle2,
  Sun,
  Moon,
  Stethoscope,
} from 'lucide-react';
import { AppUser, BreakGlassEvent } from '../types/clinical';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  activeTab: 'portal' | 'workspace' | 'schedule' | 'patients' | 'followups' | 'messaging' | 'audit';
  setActiveTab: (tab: 'portal' | 'workspace' | 'schedule' | 'patients' | 'followups' | 'messaging' | 'audit') => void;
  currentUser: AppUser;
  allUsers: AppUser[];
  onSwitchUser: (user: AppUser) => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  outboxCount: number;
  onOpenSyncModal: () => void;
  onOpenSearchModal: () => void;
  onOpenBreakGlassModal: () => void;
  activeBreakGlass: BreakGlassEvent | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  allUsers,
  onSwitchUser,
  isOnline,
  onToggleOnline,
  outboxCount,
  onOpenSyncModal,
  onOpenSearchModal,
  onOpenBreakGlassModal,
  activeBreakGlass,
}) => {
  const { isInstallable, install } = usePWAInstall();
  const { theme, isDark, toggleTheme } = useTheme();

  // Live Paris Time Clock
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'doctor':
        return { label: 'Médecin', bg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
      case 'nurse':
        return { label: 'Infirmier (IDE)', bg: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800' };
      case 'receptionist':
        return { label: 'Accueil / Secrétariat', bg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' };
      case 'auditor':
        return { label: 'DPO & Auditeur', bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
      case 'security_admin':
        return { label: 'Sécurité SI', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700' };
      default:
        return { label: role, bg: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
    }
  };

  const roleInfo = getRoleBadge(currentUser.role);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs transition-colors duration-150">
      {/* Break Glass Alert Bar if active */}
      {activeBreakGlass?.active && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-4 py-1.5 text-white text-xs font-semibold flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-white shrink-0" />
            <span>
              MODE BRIS DE GLACE ACTIF — Accès dérogatoire engagé par {activeBreakGlass.actorName} (Fin à {new Date(activeBreakGlass.expiresAt).toLocaleTimeString('fr-FR')})
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider bg-black/25 px-2 py-0.5 rounded border border-white/20">
            Traçabilité HDS Immuable
          </span>
        </div>
      )}

      {/* Main Top Header */}
      <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl">
        {/* Brand & Clinic Title */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-md shadow-blue-500/20">
            <Activity className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white font-sans">
                Clinique OneDesk
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <Shield className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                Certifié HDS
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Building2 className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              <span>Hôpital Privé Saint-Luc</span>
              <span>·</span>
              <span className="font-mono font-medium text-slate-600 dark:text-slate-300 tabular-nums">{currentTime || '23:14:00'}</span>
            </div>
          </div>
        </div>

        {/* Center: Navigation segmented bar */}
        <nav className="hidden lg:flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
          <button
            onClick={() => setActiveTab('portal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'portal'
                ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-blue-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <Stethoscope className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Portail Docteur</span>
          </button>

          <button
            onClick={() => setActiveTab('workspace')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'workspace'
                ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-blue-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Poste Médecin</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'schedule'
                ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-blue-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <Calendar className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Agenda & File</span>
          </button>

          <button
            onClick={() => setActiveTab('patients')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'patients'
                ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-blue-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Dossiers Patients</span>
          </button>

          <button
            onClick={() => setActiveTab('followups')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'followups'
                ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-blue-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Suivis & Rappels</span>
          </button>

          <button
            onClick={() => setActiveTab('messaging')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'messaging'
                ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-blue-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            <span>Messagerie</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'audit'
                ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-blue-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <Shield className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
            <span>Audit HDS</span>
          </button>
        </nav>

        {/* Right tools & user identity */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quick Search */}
          <button
            onClick={onOpenSearchModal}
            className="flex items-center gap-2 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all shadow-2xs"
            title="Recherche instantanée patient (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <span className="hidden md:inline font-medium">Rechercher</span>
            <kbd className="hidden sm:inline-block rounded-md bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
              ⌘K
            </kbd>
          </button>

          {/* Global Theme Toggle: Light / Dark Mode for Clinical Readability */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Passer en mode jour (clair)' : 'Passer en mode nuit (faible luminosité clinique)'}
            aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-2xs cursor-pointer"
          >
            {isDark ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Jour</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span className="hidden sm:inline">Nuit</span>
              </>
            )}
          </button>

          {/* Network Simulator Badge */}
          <button
            onClick={onToggleOnline}
            title={isOnline ? 'Connecté aux serveurs HDS - Cliquer pour simuler le mode hors ligne' : 'Mode hors ligne actif - Cliquer pour reconnecter'}
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition-all shadow-2xs ${
              isOnline
                ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                : 'border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {isOnline && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="hidden sm:inline">
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </span>
          </button>

          {/* Outbox Badge */}
          <button
            onClick={onOpenSyncModal}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
            title="File de synchronisation Outbox locale"
          >
            <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {outboxCount}
            </span>
          </button>

          {/* Emergency Break-Glass */}
          <button
            onClick={onOpenBreakGlassModal}
            className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50/80 dark:bg-red-950/50 px-2.5 py-1.5 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 hover:border-red-300 transition-all shadow-2xs"
            title="Procédure d'urgence dérogatoire Bris de Glace"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            <span className="hidden xl:inline">Bris de glace</span>
          </button>

          {/* PWA Install Button */}
          {isInstallable && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:from-blue-700 hover:to-indigo-700 shadow-xs transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Installer PWA</span>
            </button>
          )}

          {/* User Profile Selector Chip */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-bold text-xs shadow-xs">
                {currentUser.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">
                  {currentUser.displayName}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {currentUser.department.split('&')[0]}
                </div>
              </div>
            </div>

            <select
              value={currentUser.id}
              onChange={(e) => {
                const selected = allUsers.find((u) => u.id === e.target.value);
                if (selected) onSwitchUser(selected);
              }}
              title="Changer de profil d'utilisateur pour tester les rôles RBAC"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id} className="dark:bg-slate-900 dark:text-slate-100">
                  {u.displayName} ({u.role.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="flex lg:hidden overflow-x-auto border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 gap-2 text-xs">
        <button
          onClick={() => setActiveTab('portal')}
          className={`px-3 py-1 rounded-lg shrink-0 font-semibold transition-colors ${
            activeTab === 'portal' ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Portail Docteur
        </button>
        <button
          onClick={() => setActiveTab('workspace')}
          className={`px-3 py-1 rounded-lg shrink-0 font-semibold transition-colors ${
            activeTab === 'workspace' ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Poste Médecin
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-3 py-1 rounded-lg shrink-0 font-semibold transition-colors ${
            activeTab === 'schedule' ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Agenda
        </button>
        <button
          onClick={() => setActiveTab('patients')}
          className={`px-3 py-1 rounded-lg shrink-0 font-semibold transition-colors ${
            activeTab === 'patients' ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Dossiers
        </button>
        <button
          onClick={() => setActiveTab('followups')}
          className={`px-3 py-1 rounded-lg shrink-0 font-semibold transition-colors ${
            activeTab === 'followups' ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Suivis
        </button>
        <button
          onClick={() => setActiveTab('messaging')}
          className={`px-3 py-1 rounded-lg shrink-0 font-semibold transition-colors ${
            activeTab === 'messaging' ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Messagerie
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-1 rounded-lg shrink-0 font-semibold transition-colors ${
            activeTab === 'audit' ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Audit
        </button>
      </div>
    </header>
  );
};

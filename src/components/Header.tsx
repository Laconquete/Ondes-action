import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  AlertOctagon,
  Calendar,
  Clock,
  Download,
  FileText,
  MessageSquare,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  Users,
  Building2,
  CheckCircle2,
  Sun,
  Moon,
  Stethoscope,
  Bell,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  LogOut,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { AppUser, BreakGlassEvent, DoctorNotification } from '../types/clinical';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  activeTab: 'portal' | 'workspace' | 'schedule' | 'patients' | 'followups' | 'messaging' | 'audit' | 'nursing';
  setActiveTab: (tab: 'portal' | 'workspace' | 'schedule' | 'patients' | 'followups' | 'messaging' | 'audit' | 'nursing') => void;
  currentUser: AppUser;
  allUsers: AppUser[];
  onSwitchUser: (user: AppUser) => void;
  onLogout: () => void;
  onOpenUserManagement?: () => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  outboxCount: number;
  onOpenSyncModal: () => void;
  onOpenSearchModal: () => void;
  onOpenBreakGlassModal: () => void;
  activeBreakGlass: BreakGlassEvent | null;
  notifications?: DoctorNotification[];
  onSelectNotification?: (notification: DoctorNotification) => void;
  onOpenReceptionCheckIn?: () => void;
  tenantName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  allUsers,
  onSwitchUser,
  onLogout,
  onOpenUserManagement,
  isOnline,
  onToggleOnline,
  outboxCount,
  onOpenSyncModal,
  onOpenSearchModal,
  onOpenBreakGlassModal,
  activeBreakGlass,
  notifications = [],
  onSelectNotification,
  onOpenReceptionCheckIn,
  tenantName,
}) => {
  const { isInstallable, install } = usePWAInstall();
  const { isDark, toggleTheme } = useTheme();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Live Clock
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

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
        setIsNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

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

  const navigationItems: Array<{
    id: HeaderProps['activeTab'];
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  }> = [
    {
      id: 'portal',
      label: 'Portail Docteur',
      description: 'Cockpit médical, métriques & planning',
      icon: Stethoscope,
      accentColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      id: 'workspace',
      label: 'Poste Médecin',
      description: 'Dossier actif, SOAP & prescriptions',
      icon: FileText,
      accentColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      id: 'schedule',
      label: 'Agenda & File',
      description: 'FullCalendar, rendez-vous & salle d\'attente',
      icon: Calendar,
      accentColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      id: 'patients',
      label: 'Dossiers Patients',
      description: 'Table dynamique, tri, filtres & constantes',
      icon: Users,
      accentColor: 'text-teal-600 dark:text-teal-400',
    },
    {
      id: 'followups',
      label: 'Suivis & Rappels',
      description: 'Tâches, alertes de suivi & biologie',
      icon: UserCheck,
      accentColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'messaging',
      label: 'Messagerie',
      description: 'Échanges sécurisés MSSanté & patients',
      icon: MessageSquare,
      accentColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      id: 'nursing' as const,
      label: 'Soins Infirmiers',
      description: 'Carnet de soins, MAR & checklist directives',
      icon: Activity,
      accentColor: 'text-rose-600 dark:text-rose-400',
    },
    {
      id: 'audit',
      label: 'Audit HDS',
      description: 'Journal immuable & traçabilité RGPD',
      icon: Shield,
      accentColor: 'text-slate-700 dark:text-slate-300',
    },
  ];

  const handleSelectTab = (tab: HeaderProps['activeTab']) => {
    setActiveTab(tab);
    setIsDrawerOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs transition-colors duration-150">
        {/* Break Glass Alert Bar if active */}
        {activeBreakGlass?.active && (
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 py-1.5 shadow-sm animate-pulse">
            <div className="mx-auto max-w-[1600px] w-full px-4 sm:px-6 text-white text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <AlertOctagon className="h-4 w-4 text-white shrink-0" />
                <span className="truncate">
                  MODE BRIS DE GLACE ACTIF — Accès engagé par {activeBreakGlass.actorName} (Fin à {new Date(activeBreakGlass.expiresAt).toLocaleTimeString('fr-FR')})
                </span>
              </div>
              <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-wider bg-black/25 px-2 py-0.5 rounded border border-white/20 shrink-0">
                Traçabilité HDS Immuable
              </span>
            </div>
          </div>
        )}

        {/* Main Top Header Bar */}
        <div className="mx-auto flex h-14 sm:h-16 items-center justify-between px-2 sm:px-4 max-w-[1600px] w-full gap-1 sm:gap-4">
          {/* Brand & Logo — favicon compact sur mobile, logo complet sur desktop */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink min-w-0">
            <div className="relative h-8 w-8 sm:h-10 sm:w-10 shrink-0">
              <img
                src="/logo-FOAVICON .png"
                alt="OneDesk"
                className="h-full w-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500" />
            </div>
            {/* Nom + tenant masqués sur < lg pour gagner de l'espace */}
            <div className="hidden lg:block min-w-0">
              <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                OneDesk
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                <Building2 className="h-2.5 w-2.5 text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="truncate">{tenantName || 'Poste de Travail Clinique'}</span>
              </div>
            </div>
          </div>

          {/* Center: Compact Mega-Menu with hover submenus (xl+ screens) */}
          <nav className="hidden xl:flex items-center gap-1">
            {/* Groupe 1 : Espace Médecin */}
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Espace Médecin</span>
                <ChevronDown className="h-3 w-3 text-slate-400 group-hover:rotate-180 transition-transform" />
              </button>
              <div className="absolute left-0 top-full pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="w-64 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
                  {navigationItems.filter(i => i.id === 'portal' || i.id === 'workspace').map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full flex items-start gap-2.5 px-4 py-3 text-left border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <Icon className={`h-4 w-4 mt-0.5 ${item.accentColor}`} />
                        <div>
                          <div className="text-xs font-bold">{item.label}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</div>
                        </div>
                        {isActive && <span className="ml-auto h-2 w-2 rounded-full bg-blue-600 mt-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Groupe 2 : Patients & Planning */}
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <span>Patients</span>
                <ChevronDown className="h-3 w-3 text-slate-400 group-hover:rotate-180 transition-transform" />
              </button>
              <div className="absolute left-0 top-full pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="w-72 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
                  {navigationItems.filter(i => i.id === 'patients' || i.id === 'schedule' || i.id === 'followups' || i.id === 'nursing').map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full flex items-start gap-2.5 px-4 py-3 text-left border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <Icon className={`h-4 w-4 mt-0.5 ${item.accentColor}`} />
                        <div>
                          <div className="text-xs font-bold">{item.label}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</div>
                        </div>
                        {isActive && <span className="ml-auto h-2 w-2 rounded-full bg-blue-600 mt-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Groupe 3 : Sécurité & Conformité */}
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <Shield className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                <span>Sécurité</span>
                <ChevronDown className="h-3 w-3 text-slate-400 group-hover:rotate-180 transition-transform" />
              </button>
              <div className="absolute left-0 top-full pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="w-64 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
                  {navigationItems.filter(i => i.id === 'messaging' || i.id === 'audit').map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full flex items-start gap-2.5 px-4 py-3 text-left border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <Icon className={`h-4 w-4 mt-0.5 ${item.accentColor}`} />
                        <div>
                          <div className="text-xs font-bold">{item.label}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</div>
                        </div>
                        {isActive && <span className="ml-auto h-2 w-2 rounded-full bg-blue-600 mt-1" />}
                      </button>
                    );
                  })}
                  <button
                    onClick={onOpenBreakGlassModal}
                    className="w-full flex items-start gap-2.5 px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-red-950/30 text-red-700 dark:text-red-300 transition-colors border-t border-slate-100 dark:border-slate-800"
                  >
                    <ShieldAlert className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-400" />
                    <div>
                      <div className="text-xs font-bold">Bris de glace</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Accès d'urgence dérogatoire</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </nav>

          {/* Right Tools — Compact icon bar (encore plus compact sur mobile) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {onOpenReceptionCheckIn && (
              <button
                onClick={onOpenReceptionCheckIn}
                className="flex items-center justify-center h-9 w-9 border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all cursor-pointer"
                title="Guichet Accueil"
              >
                <UserCheck className="h-4 w-4" />
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                className="relative flex items-center justify-center h-9 w-9 border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Alertes salle d'attente"
              >
                <Bell className="h-4 w-4" />
                {notifications.filter((n) => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold ring-2 ring-white dark:ring-slate-900 animate-pulse">
                    {notifications.filter((n) => !n.read).length}
                  </span>
                )}
              </button>
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xl z-50">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">Salle d'Attente ({notifications.length})</span>
                    <span className="text-[10px] text-slate-400">Temps réel</span>
                  </div>
                  <div className="mt-2.5 max-h-72 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">Aucune arrivée.</div>
                    ) : (
                      notifications.slice(0, 8).map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => onSelectNotification?.(notif)}
                          className={`p-2.5 border cursor-pointer transition-colors ${
                            notif.read
                              ? 'border-slate-100 dark:border-slate-800 opacity-60'
                              : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/70 px-1.5 py-0.5">{notif.ticketNumber}</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{notif.patientName}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{notif.message}</p>
                          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                            <span>Salle : {notif.roomCode}</span>
                            <span>{notif.timestamp}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onOpenSearchModal}
              className="flex items-center justify-center h-9 w-9 border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Recherche patient (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Mode clair' : 'Mode sombre'}
              className="flex items-center justify-center h-9 w-9 border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
            </button>

            <button
              onClick={onToggleOnline}
              title={isOnline ? 'En ligne' : 'Hors ligne'}
              className="flex items-center justify-center h-9 w-9 border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <span className="relative flex h-2.5 w-2.5">
                {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </span>
            </button>

            <button
              onClick={onOpenSyncModal}
              className="relative flex items-center justify-center h-9 w-9 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Sync Outbox"
            >
              <Clock className="h-4 w-4" />
              {outboxCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white font-mono text-[10px] font-bold ring-2 ring-white dark:ring-slate-900">
                  {outboxCount}
                </span>
              )}
            </button>

            {/* User avatar — initiales cliquables (mobile + desktop) */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const menu = e.currentTarget.parentElement?.querySelector('.dropdown-menu');
                  if (menu) menu.classList.toggle('hidden');
                }}
                className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center bg-blue-600 text-white font-bold text-[11px] shrink-0">
                  {currentUser.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <ChevronDown className="hidden sm:block h-3 w-3 text-slate-400" />
              </button>
              <div className="dropdown-menu absolute right-0 top-full pt-1 hidden z-50 min-w-[240px]">
                <div className="w-64 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex h-8 w-8 items-center justify-center bg-blue-600 text-white font-bold text-[10px]">
                        {currentUser.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{currentUser.displayName}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{currentUser.department}</div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold border ${roleInfo.bg}`}>
                      {roleInfo.label}
                    </span>
                  </div>
                  {/* Gestion des utilisateurs (admin/directeur uniquement) */}
                  {(currentUser.role === 'medical_director' || (currentUser.role as string) === 'admin') && onOpenUserManagement && (
                    <button
                      onClick={() => { onOpenUserManagement(); const menu = document.querySelector('.dropdown-menu'); if (menu) menu.classList.add('hidden'); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200 border-t border-slate-100 dark:border-slate-800"
                    >
                      <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      Gérer les utilisateurs
                    </button>
                  )}
                  <div className="py-1">
                    <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Changer de profil
                    </div>
                    {allUsers.slice(0, 6).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { onSwitchUser(u); const menu = document.querySelector('.dropdown-menu'); if (menu) menu.classList.add('hidden'); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                          u.id === currentUser.id ? 'text-blue-700 dark:text-blue-300 font-bold' : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <span className="flex h-6 w-6 items-center justify-center bg-slate-100 dark:bg-slate-800 text-[9px] font-bold">
                          {u.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate">{u.displayName}</div>
                          <div className="text-[9px] text-slate-400 uppercase">{u.role}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { onLogout(); const menu = document.querySelector('.dropdown-menu'); if (menu) menu.classList.add('hidden'); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border-t border-slate-100 dark:border-slate-800"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Déconnexion
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Ouvrir le menu"
              className="xl:hidden flex items-center justify-center h-9 w-9 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile-Friendly Hamburger Side-Drawer with Backdrop */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          {/* Backdrop blur overlay */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Side Drawer Panel */}
          <div
            ref={drawerRef}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-xs sm:max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-transform animate-in slide-in-from-right duration-250 ease-out"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Clinique OneDesk
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Menu Praticien & Équipe
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Fermer le menu"
                className="flex items-center justify-center h-8 w-8 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {/* User Profile & Role Switcher */}
              <div className="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-500/20">
                      {currentUser.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {currentUser.displayName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {currentUser.department}
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold border shrink-0 ${roleInfo.bg}`}>
                    {roleInfo.label}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-1.5">
                  <label htmlFor="drawer-user-select" className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Changer d'utilisateur connecté :
                  </label>
                  <select
                    id="drawer-user-select"
                    value={currentUser.id}
                    onChange={(e) => {
                      const selected = allUsers.find((u) => u.id === e.target.value);
                      if (selected) onSwitchUser(selected);
                    }}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden"
                  >
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName} ({u.role.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Navigation Modules Links */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-2">
                  Modules Cliniques
                </div>
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center justify-between p-3 text-left transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center transition-colors ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold leading-tight">{item.label}</div>
                          <div
                            className={`text-xs mt-0.5 ${
                              isActive ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {item.description}
                          </div>
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 ${
                          isActive ? 'text-white' : 'text-slate-400 dark:text-slate-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Quick Actions & Security */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-2">
                  Outils & Sécurité Clinique
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {onOpenReceptionCheckIn && (
                    <button
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onOpenReceptionCheckIn();
                      }}
                      className="flex items-center gap-2 p-2.5 border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Accueil Patient</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenSearchModal();
                    }}
                    className="flex items-center gap-2 p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Search className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>Recherche (⌘K)</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenBreakGlassModal();
                    }}
                    className="flex items-center gap-2 p-2.5 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                    <span>Bris de glace</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenSyncModal();
                    }}
                    className="flex items-center gap-2 p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>Outbox ({outboxCount})</span>
                  </button>
                </div>

                {/* Offline simulator */}
                <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                  <div className="flex items-center gap-2">
                    {isOnline ? (
                      <Wifi className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-amber-600 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isOnline ? 'Réseau HDS connecté' : 'Mode hors ligne actif'}
                    </span>
                  </div>
                  <button
                    onClick={onToggleOnline}
                    className="px-2.5 py-1 text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Basculer
                  </button>
                </div>

                {/* PWA Install */}
                {isInstallable && (
                  <button
                    onClick={install}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-md cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Installer Clinique OneDesk (PWA)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

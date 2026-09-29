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
  Wifi,
  WifiOff,
} from 'lucide-react';
import { AppUser, BreakGlassEvent, DoctorNotification } from '../types/clinical';
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
  notifications?: DoctorNotification[];
  onSelectNotification?: (notification: DoctorNotification) => void;
  onOpenReceptionCheckIn?: () => void;
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
  notifications = [],
  onSelectNotification,
  onOpenReceptionCheckIn,
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
        <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-[1600px] w-full gap-2 sm:gap-4">
          {/* Brand & Clinic Title (Completely anti-overlap on all screen sizes) */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink min-w-0">
            <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-md shadow-blue-500/20 shrink-0">
              <Activity className="h-5 w-5" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white font-sans truncate">
                  Clinique OneDesk
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                  <Shield className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                  Certifié HDS
                </span>
              </div>
              <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                <Building2 className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="truncate">Hôpital Privé Saint-Luc</span>
                <span>·</span>
                <span className="font-mono font-medium text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
                  {currentTime || '23:14:00'}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Desktop Navigation segmented bar (Visible only on xl+ screens) */}
          <nav className="hidden xl:flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-blue-100 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${item.accentColor}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Tools & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Desktop Reception Check-In desk shortcut */}
            {onOpenReceptionCheckIn && (
              <button
                onClick={onOpenReceptionCheckIn}
                className="hidden lg:flex items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-2xs cursor-pointer"
                title="Guichet Accueil & Admission d'un patient arrivé"
              >
                <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Accueil / Arrivée</span>
              </button>
            )}

            {/* Real-time Doctor Notifications */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                className="relative flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Alertes d'arrivée en salle d'attente"
                aria-label="Alertes salle d'attente"
              >
                <Bell className="h-4 w-4" />
                {notifications.filter((n) => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold ring-2 ring-white dark:ring-slate-900 animate-pulse">
                    {notifications.filter((n) => !n.read).length}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xl z-50 transition-all animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        Salle d'Attente ({notifications.length})
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">Temps réel</span>
                  </div>

                  <div className="mt-2.5 max-h-72 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        Aucune nouvelle arrivée en salle d'attente pour le moment.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            if (onSelectNotification) onSelectNotification(notif);
                          }}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                            !notif.read
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60'
                              : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
                          } hover:border-blue-400`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                              {notif.patientName}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/70 px-1.5 py-0.5 rounded">
                              {notif.ticketNumber}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                            {notif.message}
                          </p>
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

            {/* Quick Search Button (Desktop) */}
            <button
              onClick={onOpenSearchModal}
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all shadow-2xs cursor-pointer"
              title="Recherche instantanée patient (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <span className="hidden md:inline font-medium">Rechercher</span>
              <kbd className="hidden md:inline-block rounded-md bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
                ⌘K
              </kbd>
            </button>

            {/* Global Theme Toggle: Light / Dark Mode (Always visible, compact) */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Passer en mode jour (clair)' : 'Passer en mode nuit (faible luminosité clinique)'}
              aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
              className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-2xs cursor-pointer shrink-0"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-amber-400 shrink-0" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-600 shrink-0" />
              )}
            </button>

            {/* Desktop Network Simulator Badge */}
            <button
              onClick={onToggleOnline}
              title={isOnline ? 'Connecté aux serveurs HDS - Cliquer pour simuler le mode hors ligne' : 'Mode hors ligne actif - Cliquer pour reconnecter'}
              className={`hidden md:flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition-all shadow-2xs cursor-pointer ${
                isOnline
                  ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                  : 'border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40'
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
              <span className="hidden lg:inline">
                {isOnline ? 'En ligne' : 'Hors ligne'}
              </span>
            </button>

            {/* Desktop Outbox Badge */}
            <button
              onClick={onOpenSyncModal}
              className="hidden md:flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
              title="File de synchronisation Outbox locale"
            >
              <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {outboxCount}
              </span>
            </button>

            {/* Desktop Bris de Glace Button */}
            <button
              onClick={onOpenBreakGlassModal}
              className="hidden xl:flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50/80 dark:bg-red-950/50 px-2.5 py-1.5 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 hover:border-red-300 transition-all shadow-2xs cursor-pointer"
              title="Procédure d'urgence dérogatoire Bris de Glace"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              <span>Bris de glace</span>
            </button>

            {/* Desktop User Profile Selector Chip */}
            <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-bold text-xs shadow-xs">
                  {currentUser.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">
                    {currentUser.displayName}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {currentUser.department.split('&')[0]}
                  </div>
                </div>
              </div>

              <select
                aria-label="Changer de profil d'utilisateur"
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

            {/* Mobile / Tablet Hamburger Button (Replaces horizontal navigation completely on < xl) */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Ouvrir le menu de navigation"
              className="xl:hidden flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            >
              <Menu className="h-5 w-5 text-slate-800 dark:text-slate-100" />
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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20">
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
                className="flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {/* User Profile & Role Switcher */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-500/20">
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
                  <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold border shrink-0 ${roleInfo.bg}`}>
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
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden"
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
                      className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
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
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 text-xs font-bold transition-colors cursor-pointer"
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
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Search className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>Recherche (⌘K)</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenBreakGlassModal();
                    }}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                    <span>Bris de glace</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenSyncModal();
                    }}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>Outbox ({outboxCount})</span>
                  </button>
                </div>

                {/* Offline simulator */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
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
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Basculer
                  </button>
                </div>

                {/* PWA Install */}
                {isInstallable && (
                  <button
                    onClick={install}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-md cursor-pointer"
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

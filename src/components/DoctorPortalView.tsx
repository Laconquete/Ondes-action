import React, { useState, useMemo } from 'react';
import {
  Users,
  Calendar,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  MessageSquare,
  ArrowRight,
  UserCheck,
  Stethoscope,
  ChevronRight,
  ShieldAlert,
  Search,
  Plus,
  Play,
  UserPlus,
  Filter,
  HeartPulse,
} from 'lucide-react';
import {
  AppUser,
  Patient,
  Appointment,
  QueueTicket,
  FollowUpTask,
  SecureConversation,
} from '../types/clinical';
import {
  analyzePatientVitals,
  getCabinetVitalAlertsSummary,
  getPatientAlertLevel,
} from '../services/clinicalAlertsEngine';

interface DoctorPortalViewProps {
  currentUser: AppUser;
  allUsers: AppUser[];
  onSwitchUser: (user: AppUser) => void;
  patients: Patient[];
  appointments: Appointment[];
  queueTickets: QueueTicket[];
  followUps: FollowUpTask[];
  conversations: SecureConversation[];
  onOpenConsultation: (patientId: string) => void;
  onNavigateToSchedule: () => void;
  onNavigateToPatients: () => void;
  onNavigateToFollowUps: () => void;
  onNavigateToMessaging: () => void;
  onOpenCreateAppointment: () => void;
  onOpenCreatePatient: () => void;
  onOpenReceptionCheckIn?: () => void;
}

export const DoctorPortalView: React.FC<DoctorPortalViewProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  patients,
  appointments,
  queueTickets,
  followUps,
  conversations,
  onOpenConsultation,
  onNavigateToSchedule,
  onNavigateToPatients,
  onNavigateToFollowUps,
  onNavigateToMessaging,
  onOpenCreateAppointment,
  onOpenCreatePatient,
  onOpenReceptionCheckIn,
}) => {
  const [patientSearch, setPatientSearch] = useState('');
  const [viewScope, setViewScope] = useState<'my' | 'all'>('my');
  const [alertFilter, setAlertFilter] = useState<'all' | 'alerts_only' | 'blood_pressure' | 'pulse'>('all');

  // Filter practitioners (doctors)
  const doctors = allUsers.filter((u) => u.role === 'doctor');

  // Filter patients for this doctor
  const myPatients = patients.filter(
    (p) => p.primaryDoctorId === currentUser.id || !p.primaryDoctorId
  );

  const relevantPatients = viewScope === 'my' ? myPatients : patients;
  const alertsSummary = useMemo(
    () => getCabinetVitalAlertsSummary(relevantPatients),
    [relevantPatients]
  );

  const displayedPatients = relevantPatients.filter((p) => {
    // Clinical alert filters
    if (alertFilter === 'alerts_only') {
      const alerts = analyzePatientVitals(p);
      if (alerts.length === 0) return false;
    } else if (alertFilter === 'blood_pressure') {
      const alerts = analyzePatientVitals(p);
      if (!alerts.some((a) => a.category === 'blood_pressure')) return false;
    } else if (alertFilter === 'pulse') {
      const alerts = analyzePatientVitals(p);
      if (!alerts.some((a) => a.category === 'pulse')) return false;
    }

    if (!patientSearch.trim()) return true;
    const term = patientSearch.toLowerCase();
    return (
      p.familyName.toLowerCase().includes(term) ||
      p.givenName.toLowerCase().includes(term) ||
      p.medicalRecordNumber.toLowerCase().includes(term) ||
      p.problems.some((prob) => prob.display.toLowerCase().includes(term))
    );
  });

  // Today's appointments
  const todayDateStr = new Date().toISOString().split('T')[0];
  const myTodayAppointments = appointments
    .filter((a) => {
      const isToday = a.startsAt.startsWith(todayDateStr);
      const isDoc = viewScope === 'my' ? a.practitionerId === currentUser.id : true;
      return isToday && isDoc;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  // Doctor followups
  const myPendingFollowUps = followUps.filter(
    (f) =>
      (viewScope === 'my' ? f.assignedToId === currentUser.id : true) &&
      (f.status === 'pending' || f.status === 'in_progress')
  );

  // Unread messages
  const unreadMessagesCount = conversations.filter(
    (c) =>
      (viewScope === 'my' ? c.practitionerId === currentUser.id : true) &&
      c.unreadByDoctor
  ).length;

  // Active queue tickets
  const activeQueue = queueTickets.filter(
    (t) => t.status === 'waiting' || t.status === 'called'
  );

  return (
    <div className="space-y-6">
      {/* WuKong CRM inspired Doctor Profile & Cockpit Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-clinical transition-colors">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
        
        <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xl shadow-md shadow-blue-500/20">
                {currentUser.displayName
                  .split(' ')
                  .map((n) => n[0])
                  .filter((_, i) => i > 0 || !currentUser.displayName.startsWith('Dr.'))
                  .slice(0, 2)
                  .join('') || 'DR'}
              </div>
              <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Portail Praticien : {currentUser.displayName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 px-2.5 py-0.5 text-xs font-semibold">
                  <Stethoscope className="h-3 w-3" />
                  {currentUser.department}
                </span>
                {currentUser.licenseNumber && (
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {currentUser.licenseNumber}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Poste de pilotage médical longitudinal · HDS & MSSanté connecté · Cabinet Médical Pluridisciplinaire
              </p>
            </div>
          </div>

          {/* Quick Doctor Switcher / Portal Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-1">
              <button
                onClick={() => setViewScope('my')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewScope === 'my'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Mon Espace Personnel
              </button>
              <button
                onClick={() => setViewScope('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewScope === 'all'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Vue Équipe Cabinet ({doctors.length} médecins)
              </button>
            </div>

            {/* Switch doctor dropdown */}
            <div className="relative">
              <label className="sr-only">Changer de docteur</label>
              <select
                aria-label="Changer de praticien connecté"
                value={currentUser.id}
                onChange={(e) => {
                  const targetDoc = allUsers.find((u) => u.id === e.target.value);
                  if (targetDoc) onSwitchUser(targetDoc);
                }}
                className="appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <optgroup label="Médecins du Cabinet">
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.displayName} ({doc.department})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Personnel de Soins & Accueil">
                  {allUsers
                    .filter((u) => u.role !== 'doctor')
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName} ({user.role})
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {/* 5-Column KPI Row inspired by CRM dashboards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/90">
          <div
            onClick={onNavigateToSchedule}
            className="p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                RDV Aujourd'hui
              </span>
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-slate-950 dark:text-white">
                {myTodayAppointments.length}
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {myTodayAppointments.filter((a) => a.status === 'completed').length} terminés
              </span>
            </div>
          </div>

          <div
            onClick={onNavigateToPatients}
            className="p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Patients Suivis
              </span>
              <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-2xl font-black text-slate-950 dark:text-white">
                {myPatients.length}
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                sur {patients.length} cabinet
              </span>
              {alertsSummary.totalAlerts > 0 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setAlertFilter('alerts_only');
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-rose-100 dark:bg-rose-950/80 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse cursor-pointer hover:bg-rose-200"
                  title="Cliquer pour afficher uniquement les patients avec alertes vitales"
                >
                  <AlertTriangle className="h-2.5 w-2.5 text-rose-600" />
                  {alertsSummary.totalAlerts} alerte(s)
                </span>
              )}
            </div>
          </div>

          <div
            onClick={onNavigateToSchedule}
            className="p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Salle d'Attente
              </span>
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-slate-950 dark:text-white">
                {activeQueue.length}
              </span>
              <span className="text-xs text-amber-800 dark:text-amber-300 font-extrabold">
                en attente
              </span>
            </div>
          </div>

          <div
            onClick={onNavigateToFollowUps}
            className="p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tâches & Suivis
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-slate-950 dark:text-white">
                {myPendingFollowUps.length}
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                à réaliser
              </span>
            </div>
          </div>

          <div
            onClick={onNavigateToMessaging}
            className="p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                MSSanté Non Lus
              </span>
              <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-slate-950 dark:text-white">
                {unreadMessagesCount}
              </span>
              <span className="text-xs text-purple-800 dark:text-purple-300 font-extrabold">
                sécurisés
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content: Left = Dynamic Patient CRM List, Right = Today's Planning & Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Interactive Patient Portfolio & Search */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-clinical transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span>
                    {viewScope === 'my'
                      ? `Mes Patients Attribués (${myPatients.length})`
                      : `Tous les Patients du Cabinet (${patients.length})`}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cliquez sur un patient pour ouvrir sa fiche clinique ou lancer sa consultation
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenCreatePatient}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Nouveau Patient</span>
                </button>
              </div>
            </div>

            {/* Moteur d'Alertes Cliniques & Surveillance des Constantes (Temps Réel) */}
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-gradient-to-r from-rose-50/90 via-amber-50/60 to-white dark:from-rose-950/40 dark:via-amber-950/30 dark:to-slate-900 p-4 mb-4 shadow-xs transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-md shadow-rose-500/20 shrink-0">
                    <Activity className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-rose-950 dark:text-rose-100">
                        Moteur d'Alertes Cliniques Temps Réel
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white shadow-2xs">
                        {alertsSummary.totalAlerts} alerte(s) active(s)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      Surveillance continue HAS / SFHTA · Dépistage HTA non contrôlée, tachycardie & hypoxie
                    </p>
                  </div>
                </div>

                {/* Filtres d'alertes instantanés */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAlertFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      alertFilter === 'all'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                        : 'bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white'
                    }`}
                  >
                    Tous ({relevantPatients.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlertFilter(alertFilter === 'alerts_only' ? 'all' : 'alerts_only')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      alertFilter === 'alerts_only'
                        ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400'
                        : 'bg-rose-100/80 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 hover:bg-rose-200/80 border border-rose-200 dark:border-rose-900'
                    }`}
                  >
                    <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                    <span>Alertes Vitales ({alertsSummary.patientsWithAlerts.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlertFilter(alertFilter === 'blood_pressure' ? 'all' : 'blood_pressure')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      alertFilter === 'blood_pressure'
                        ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                        : 'bg-amber-100/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200/80 border border-amber-200 dark:border-amber-900'
                    }`}
                  >
                    <HeartPulse className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    <span>Tension (HTA)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlertFilter(alertFilter === 'pulse' ? 'all' : 'pulse')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      alertFilter === 'pulse'
                        ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400'
                        : 'bg-red-100/80 dark:bg-red-950/60 text-red-800 dark:text-red-300 hover:bg-red-200/80 border border-red-200 dark:border-red-900'
                    }`}
                  >
                    <Activity className="h-3 w-3 text-red-600 dark:text-red-400" />
                    <span>Pouls / FC</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, prénom, IPP (MRN-...), ou pathologie..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2 pl-9 pr-4 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 focus:outline-hidden transition-colors"
              />
            </div>

            {/* Dynamic Clickable Patient Cards */}
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {displayedPatients.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                  Aucun patient ne correspond aux critères de recherche ou de filtre d'alerte.
                </div>
              ) : (
                displayedPatients.map((patient) => {
                  const latestVitals = patient.vitalsHistory[patient.vitalsHistory.length - 1];
                  const hasCriticalAllergy = patient.allergies.some(
                    (a) => a.severity === 'critical' || a.severity === 'life_threatening'
                  );
                  const isAssignedToMe = patient.primaryDoctorId === currentUser.id;

                  // Real-time clinical vital alerts analysis
                  const vitalAlerts = analyzePatientVitals(patient);
                  const hasVitalAlert = vitalAlerts.length > 0;
                  const alertLevel = getPatientAlertLevel(vitalAlerts);

                  return (
                    <div
                      key={patient.id}
                      onClick={() => onOpenConsultation(patient.id)}
                      className={`group cursor-pointer rounded-xl p-3.5 transition-all shadow-2xs ${
                        hasVitalAlert
                          ? alertLevel === 'critical'
                            ? 'border-2 border-rose-500 bg-rose-50/25 dark:bg-rose-950/25 hover:border-rose-600'
                            : 'border-2 border-amber-400 dark:border-amber-600 bg-amber-50/20 dark:bg-amber-950/20 hover:border-amber-500'
                          : 'border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850/60 hover:border-blue-500/60 hover:bg-blue-50/20 dark:hover:bg-blue-950/20'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm transition-colors ${
                            hasVitalAlert
                              ? alertLevel === 'critical'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-amber-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-blue-600 group-hover:text-white'
                          }`}>
                            {patient.familyName[0]}
                            {patient.givenName[0]}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {patient.familyName.toUpperCase()} {patient.givenName}
                              </span>
                              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {patient.medicalRecordNumber}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                · {patient.gender === 'F' ? 'Femme' : 'Homme'},{' '}
                                {new Date().getFullYear() - new Date(patient.birthDate).getFullYear()} ans
                              </span>
                            </div>

                            {/* Vital Alerts & Pathologies Badges */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {/* Clinical Vital Signs Alerts Pills (High Visibility) */}
                              {vitalAlerts.map((alt) => (
                                <span
                                  key={alt.id}
                                  title={`${alt.title} — ${alt.recommendation}`}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                    alt.severity === 'critical'
                                      ? 'bg-rose-600 text-white animate-pulse shadow-xs'
                                      : 'bg-amber-100 dark:bg-amber-950/90 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                                  }`}
                                >
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  <span>{alt.badgeLabel} : {alt.valueDisplay}</span>
                                </span>
                              ))}

                              {patient.problems.slice(0, 2).map((prob) => (
                                <span
                                  key={prob.id}
                                  className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300"
                                >
                                  {prob.display}
                                </span>
                              ))}

                              {hasCriticalAllergy && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                                  <AlertTriangle className="h-3 w-3" />
                                  Allergie Critique
                                </span>
                              )}

                              {patient.primaryDoctorName && (
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    isAssignedToMe
                                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  Réf: {patient.primaryDoctorName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Vitals snapshot & Action button */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-200 dark:border-slate-800 pt-2 sm:pt-0">
                          {latestVitals && (
                            <div className="text-right">
                              <span className="block text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center justify-end gap-1">
                                {hasVitalAlert && (
                                  <span className="inline-flex h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                                )}
                                Dernières constantes
                              </span>
                              <span className={`font-mono text-xs font-black tabular-nums ${
                                hasVitalAlert
                                  ? alertLevel === 'critical'
                                    ? 'text-rose-600 dark:text-rose-400 font-black'
                                    : 'text-amber-700 dark:text-amber-300 font-black'
                                  : 'text-slate-950 dark:text-white'
                              }`}>
                                {latestVitals.systolic}/{latestVitals.diastolic} mmHg ·{' '}
                                {latestVitals.pulseBpm} bpm
                              </span>
                            </div>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenConsultation(patient.id);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold shadow-xs hover:scale-102 transition-all cursor-pointer ${
                              hasVitalAlert
                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white'
                            }`}
                            title="Ouvrir le dossier patient"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>Consulter</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Today's Schedule & Quick Actions */}
        <div className="lg:col-span-4 space-y-4">
          {/* Quick Actions Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical transition-colors">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Actions Immédiates
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onOpenCreateAppointment}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40 text-center transition-all group"
              >
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Prendre RDV
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  FullCalendar
                </span>
              </button>

              <button
                onClick={onOpenCreatePatient}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40 text-center transition-all group"
              >
                <UserPlus className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Nouveau Patient
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Création dossier
                </span>
              </button>

              {onOpenReceptionCheckIn && (
                <button
                  onClick={onOpenReceptionCheckIn}
                  className="col-span-2 flex items-center justify-center gap-2 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 hover:border-emerald-500 dark:hover:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-center transition-all group cursor-pointer"
                >
                  <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Guichet Accueil & Arrivée Patient
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Today's Appointments Timeline */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-clinical transition-colors">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Mon Agenda du Jour ({myTodayAppointments.length})</span>
              </h3>
              <button
                onClick={onNavigateToSchedule}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                <span>Vue complète</span>
                <span>&rarr;</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {myTodayAppointments.length === 0 ? (
                <div className="py-8 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Aucun rendez-vous planifié aujourd'hui pour ce praticien.
                </div>
              ) : (
                myTodayAppointments.map((apt) => {
                  const startTimeStr = new Date(apt.startsAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  // Format French status display and high-contrast badge styles
                  let statusLabel = 'Planifié';
                  let statusBadgeClass =
                    'border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100';

                  if (apt.status === 'completed') {
                    statusLabel = 'Terminé';
                    statusBadgeClass =
                      'border border-emerald-400 dark:border-emerald-600 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-200 font-extrabold';
                  } else if (apt.status === 'arrived') {
                    statusLabel = 'En salle d\'attente';
                    statusBadgeClass =
                      'border border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 font-extrabold';
                  } else if (apt.status === 'confirmed') {
                    statusLabel = 'Confirmé';
                    statusBadgeClass =
                      'border border-blue-400 dark:border-blue-600 bg-blue-100 dark:bg-blue-950/80 text-blue-950 dark:text-blue-200 font-extrabold';
                  } else if (apt.status === 'in_progress') {
                    statusLabel = 'En consultation';
                    statusBadgeClass =
                      'border border-indigo-400 dark:border-indigo-600 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-950 dark:text-indigo-200 font-extrabold';
                  } else if (apt.status === 'cancelled') {
                    statusLabel = 'Annulé';
                    statusBadgeClass =
                      'border border-rose-400 dark:border-rose-600 bg-rose-100 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 font-extrabold';
                  }

                  return (
                    <div
                      key={apt.id}
                      className="rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/90 p-3 text-xs shadow-xs hover:border-blue-500 dark:hover:border-blue-400 transition-all"
                    >
                      {/* Top Row: Time and Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="font-mono font-black text-sm text-slate-950 dark:text-white">
                            {startTimeStr}
                          </span>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] uppercase tracking-wide ${statusBadgeClass}`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {/* Patient Name */}
                      <div className="mt-2 text-sm font-bold text-slate-950 dark:text-white tracking-tight">
                        {apt.patientName}
                      </div>

                      {/* Reason with clear, high contrast text */}
                      <div className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug">
                        {apt.reason}
                      </div>

                      {/* Bottom Row: Room and Solid Démarrer Button */}
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          Salle {apt.roomCode}
                        </span>
                        <button
                          onClick={() => onOpenConsultation(apt.patientId)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-bold text-xs px-3 py-1.5 shadow-sm hover:scale-102 transition-all cursor-pointer"
                          title="Démarrer la consultation médicale"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>Démarrer</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

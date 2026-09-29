import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  AppUser,
  Patient,
  Appointment,
  QueueTicket,
  FollowUpTask,
  SecureConversation,
} from '../types/clinical';

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
}) => {
  const [patientSearch, setPatientSearch] = useState('');
  const [viewScope, setViewScope] = useState<'my' | 'all'>('my');

  // Filter practitioners (doctors)
  const doctors = allUsers.filter((u) => u.role === 'doctor');

  // Filter patients for this doctor
  const myPatients = patients.filter(
    (p) => p.primaryDoctorId === currentUser.id || !p.primaryDoctorId
  );
  const displayedPatients = (viewScope === 'my' ? myPatients : patients).filter((p) => {
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div
            onClick={onNavigateToSchedule}
            className="p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                RDV Aujourd'hui
              </span>
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100">
                {myTodayAppointments.length}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {myTodayAppointments.filter((a) => a.status === 'completed').length} terminés
              </span>
            </div>
          </div>

          <div
            onClick={onNavigateToPatients}
            className="p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Patients Suivis
              </span>
              <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100">
                {myPatients.length}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                sur {patients.length} cabinet
              </span>
            </div>
          </div>

          <div
            onClick={onNavigateToSchedule}
            className="p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Salle d'Attente
              </span>
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100">
                {activeQueue.length}
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                en attente
              </span>
            </div>
          </div>

          <div
            onClick={onNavigateToFollowUps}
            className="p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Tâches & Suivis
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100">
                {myPendingFollowUps.length}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                à réaliser
              </span>
            </div>
          </div>

          <div
            onClick={onNavigateToMessaging}
            className="p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                MSSanté Non Lus
              </span>
              <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100">
                {unreadMessagesCount}
              </span>
              <span className="text-[11px] text-purple-700 dark:text-purple-400 font-semibold">
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
                  Aucun patient ne correspond aux critères de recherche.
                </div>
              ) : (
                displayedPatients.map((patient) => {
                  const latestVitals = patient.vitalsHistory[patient.vitalsHistory.length - 1];
                  const hasCriticalAllergy = patient.allergies.some(
                    (a) => a.severity === 'critical' || a.severity === 'life_threatening'
                  );
                  const isAssignedToMe = patient.primaryDoctorId === currentUser.id;

                  return (
                    <div
                      key={patient.id}
                      onClick={() => onOpenConsultation(patient.id)}
                      className="group cursor-pointer rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850/60 p-3.5 hover:border-blue-500/60 dark:hover:border-blue-500/60 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-all shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
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

                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                        <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-2 sm:pt-0">
                          {latestVitals && (
                            <div className="text-right">
                              <span className="block text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                Dernières constantes
                              </span>
                              <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
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
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2.5 py-1 text-xs font-semibold transition-colors"
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
            </div>
          </div>

          {/* Today's Appointments Timeline */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical transition-colors">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Mon Agenda du Jour ({myTodayAppointments.length})</span>
              </h3>
              <button
                onClick={onNavigateToSchedule}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Vue complète &rarr;
              </button>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto">
              {myTodayAppointments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Aucun rendez-vous planifié aujourd'hui pour ce praticien.
                </div>
              ) : (
                myTodayAppointments.map((apt) => {
                  const startTimeStr = new Date(apt.startsAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={apt.id}
                      className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 p-2.5 text-xs transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {startTimeStr}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            apt.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : apt.status === 'arrived'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          {apt.status === 'arrived' ? 'En salle' : apt.status}
                        </span>
                      </div>

                      <div className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                        {apt.patientName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {apt.reason}
                      </div>

                      <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          Salle {apt.roomCode}
                        </span>
                        <button
                          onClick={() => onOpenConsultation(apt.patientId)}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                        >
                          <span>Démarrer</span>
                          <ChevronRight className="h-3 w-3" />
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

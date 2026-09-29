import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Filter,
  Plus,
  User,
  Users,
  AlertTriangle,
  CheckCircle,
  Play,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Stethoscope,
  Video,
  AlertCircle,
  MapPin,
  CalendarCheck,
} from 'lucide-react';
import { Appointment, AppUser, Patient, QueueTicket } from '../types/clinical';
import { checkAppointmentConflict, ScheduleConflictResult } from '../services/clinicalEngine';
import { AppointmentConflictDialog } from './AppointmentConflictDialog';

interface DoctorScheduleProps {
  appointments: Appointment[];
  queueTickets: QueueTicket[];
  patients: Patient[];
  practitioners: AppUser[];
  currentPractitionerId: string;
  onOpenConsultationForPatient: (patientId: string) => void;
  onAddAppointment: (appointment: Appointment) => void;
  onUpdateAppointmentStatus: (
    appointmentId: string,
    status: Appointment['status']
  ) => void;
  onCallQueueTicket: (ticketId: string) => void;
  canManageSchedule: boolean;
}

type CalendarViewMode = 'month' | 'week' | 'day' | 'list';

export const DoctorSchedule: React.FC<DoctorScheduleProps> = ({
  appointments,
  queueTickets,
  patients,
  practitioners,
  currentPractitionerId,
  onOpenConsultationForPatient,
  onAddAppointment,
  onUpdateAppointmentStatus,
  onCallQueueTicket,
  canManageSchedule,
}) => {
  // Calendar view mode: 'month' (Mois), 'week' (Semaine), 'day' (Jour), 'list' (Liste)
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  // Currently selected practitioner filter: 'all' or specific doctor id
  const [selectedPractitioner, setSelectedPractitioner] = useState<string>(
    currentPractitionerId || 'all'
  );

  // Reference date: defaults to 2026-09-29
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 8, 29)); // Sept 29, 2026

  // Status filter
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected appointment detail modal
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Appointment creation modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [patientId, setPatientId] = useState(patients[0]?.id || '');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('2026-09-29');
  const [startTime, setStartTime] = useState('10:30');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [appointmentType, setAppointmentType] = useState<Appointment['appointmentType']>('consultation');
  const [appointmentReason, setAppointmentReason] = useState('Consultation de suivi');
  const [roomCode, setRoomCode] = useState('Box 1');
  const [targetPractitionerId, setTargetPractitionerId] = useState(
    currentPractitionerId || practitioners[0]?.id || ''
  );

  // Collision state
  const [conflictResult, setConflictResult] = useState<ScheduleConflictResult | null>(null);
  const [requestedSlot, setRequestedSlot] = useState<{ startsAt: string; endsAt: string } | null>(null);

  // Date formatted strings
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const monthTitle = currentDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  // Filtered appointments by practitioner and status
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const matchDoc =
        selectedPractitioner === 'all' || a.practitionerId === selectedPractitioner;
      const matchStatus =
        statusFilter === 'all' || a.status === statusFilter;
      return matchDoc && matchStatus;
    });
  }, [appointments, selectedPractitioner, statusFilter]);

  // Navigate calendar
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() - 1);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 8, 29)); // Today in app reference: Sept 29, 2026
  };

  // Open creation modal prefilled with day
  const handleDayClick = (dateStr: string) => {
    setAppointmentDate(dateStr);
    setIsCreateOpen(true);
  };

  // Submit appointment creation
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPatient = patients.find((p) => p.id === patientId);
    const selectedDoc =
      practitioners.find((d) => d.id === targetPractitionerId) || practitioners[0];
    if (!selectedPatient || !selectedDoc) return;

    const startsAt = `${appointmentDate}T${startTime}:00.000Z`;
    const startObj = new Date(startsAt);
    const endObj = new Date(startObj.getTime() + durationMinutes * 60 * 1000);
    const endsAt = endObj.toISOString();

    // Verification du moteur de collision clinique
    const conflict = checkAppointmentConflict(
      selectedDoc.id,
      startsAt,
      endsAt,
      appointments
    );

    if (conflict.hasConflict) {
      setConflictResult(conflict);
      setRequestedSlot({ startsAt, endsAt });
      return;
    }

    const newApt: Appointment = {
      id: `apt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.givenName} ${selectedPatient.familyName}`,
      patientMrn: selectedPatient.medicalRecordNumber,
      practitionerId: selectedDoc.id,
      practitionerName: selectedDoc.displayName,
      serviceCode: selectedDoc.serviceCode || 'MED-GEN',
      appointmentType,
      startsAt,
      endsAt,
      status: 'confirmed',
      reason: appointmentReason,
      roomCode,
      priority: appointmentType === 'urgence' ? 2 : 0,
    };

    onAddAppointment(newApt);
    setIsCreateOpen(false);
  };

  // Force add after conflict override
  const handleForceSchedule = () => {
    if (!conflictResult || !requestedSlot) return;
    const selectedPatient = patients.find((p) => p.id === patientId);
    const selectedDoc =
      practitioners.find((d) => d.id === targetPractitionerId) || practitioners[0];
    if (!selectedPatient || !selectedDoc) return;

    const newApt: Appointment = {
      id: `apt_override_${Date.now()}`,
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.givenName} ${selectedPatient.familyName}`,
      patientMrn: selectedPatient.medicalRecordNumber,
      practitionerId: selectedDoc.id,
      practitionerName: selectedDoc.displayName,
      serviceCode: selectedDoc.serviceCode || 'MED-GEN',
      appointmentType,
      startsAt: requestedSlot.startsAt,
      endsAt: requestedSlot.endsAt,
      status: 'confirmed',
      reason: `[FORCÉ - Collision acceptée] ${appointmentReason}`,
      roomCode,
      priority: 2,
    };

    onAddAppointment(newApt);
    setConflictResult(null);
    setRequestedSlot(null);
    setIsCreateOpen(false);
  };

  // Build Month Grid: 6 weeks = 42 days (from Monday before 1st to Sunday after)
  const monthDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startingDayIndex = (firstDayOfMonth.getDay() + 6) % 7; // 0 = Lundi, 6 = Dimanche

    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - startingDayIndex);

    const days = [];
    const iterator = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const year = iterator.getFullYear();
      const month = String(iterator.getMonth() + 1).padStart(2, '0');
      const day = String(iterator.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const isCurrentMonth = iterator.getMonth() === currentMonth;
      const isPast = iterator < new Date(2026, 8, 29);
      const isToday = dateStr === '2026-09-29';
      const isFuture = iterator > new Date(2026, 8, 29);

      // Appointments on this day
      const dayApts = filteredAppointments.filter((a) =>
        a.startsAt.startsWith(dateStr)
      );

      days.push({
        date: new Date(iterator),
        dateStr,
        dayNumber: iterator.getDate(),
        isCurrentMonth,
        isPast,
        isToday,
        isFuture,
        appointments: dayApts,
      });

      iterator.setDate(iterator.getDate() + 1);
    }

    return days;
  }, [currentYear, currentMonth, filteredAppointments]);

  // Build Week Days (Monday to Sunday around currentDate)
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const dayOfWeek = (curr.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(curr);
    monday.setDate(monday.getDate() - dayOfWeek);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      days.push({
        date: d,
        dateStr,
        dayLabel: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
        appointments: filteredAppointments.filter((a) => a.startsAt.startsWith(dateStr)),
      });
    }
    return days;
  }, [currentDate, filteredAppointments]);

  // Filtered patients for dropdown search
  const filteredPatients = useMemo(() => {
    if (!patientSearchQuery.trim()) return patients.slice(0, 8);
    const q = patientSearchQuery.toLowerCase();
    return patients.filter(
      (p) =>
        p.familyName.toLowerCase().includes(q) ||
        p.givenName.toLowerCase().includes(q) ||
        p.medicalRecordNumber.toLowerCase().includes(q)
    );
  }, [patients, patientSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Filter & Action Bar inspired by CRM header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical transition-colors">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
              <Calendar className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Agenda Clinique des Consultations
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gestion des créneaux, collisions en temps réel et salle d'attente
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          {/* Practitioner Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span>Praticien :</span>
            </label>
            <select
              aria-label="Filtrer par praticien"
              value={selectedPractitioner}
              onChange={(e) => setSelectedPractitioner(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les praticiens ({practitioners.length})</option>
              {practitioners.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.displayName} — {doc.department}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" />
              <span>Statut :</span>
            </label>
            <select
              aria-label="Filtrer par statut de rendez-vous"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="arrived">En salle d'attente</option>
              <option value="confirmed">Confirmés</option>
              <option value="in_progress">En consultation</option>
              <option value="completed">Terminés</option>
              <option value="cancelled">Annulés</option>
            </select>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {canManageSchedule && (
            <button
              onClick={() => {
                setAppointmentDate('2026-09-29');
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Nouveau RDV</span>
            </button>
          )}
        </div>
      </div>

      {/* Exact Card Body & FullCalendar Structure as requested */}
      <div className="card-body rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-clinical transition-colors">
        <div
          id="calendarRdv"
          style={{ minHeight: '500px' }}
          className="fc fc-media-screen fc-direction-ltr fc-theme-standard"
        >
          {/* Header Toolbar */}
          <div className="fc-header-toolbar fc-toolbar fc-toolbar-ltr">
            {/* Chunk 1: Prev, Next, Today */}
            <div className="fc-toolbar-chunk">
              <div className="fc-button-group">
                <button
                  type="button"
                  title="Précédent"
                  aria-pressed="false"
                  onClick={handlePrev}
                  className="fc-prev-button fc-button fc-button-primary"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Suivant"
                  aria-pressed="false"
                  onClick={handleNext}
                  className="fc-next-button fc-button fc-button-primary"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                title="Auj."
                aria-pressed="false"
                onClick={handleToday}
                className="fc-today-button fc-button fc-button-primary"
              >
                Auj.
              </button>
            </div>

            {/* Chunk 2: Month / Date Title */}
            <div className="fc-toolbar-chunk">
              <h2 className="fc-toolbar-title" id="fc-dom-1">
                {viewMode === 'month'
                  ? monthTitle
                  : viewMode === 'week'
                  ? `Semaine du ${weekDays[0]?.dayLabel} au ${weekDays[6]?.dayLabel}`
                  : currentDate.toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
              </h2>
            </div>

            {/* Chunk 3: View Mode Switcher (Mois, Semaine, Jour, Liste) */}
            <div className="fc-toolbar-chunk">
              <div className="fc-button-group">
                <button
                  type="button"
                  title="Mois"
                  aria-pressed={viewMode === 'month'}
                  onClick={() => setViewMode('month')}
                  className={`fc-dayGridMonth-button fc-button fc-button-primary ${
                    viewMode === 'month' ? 'fc-button-active' : ''
                  }`}
                >
                  Mois
                </button>
                <button
                  type="button"
                  title="Semaine"
                  aria-pressed={viewMode === 'week'}
                  onClick={() => setViewMode('week')}
                  className={`fc-timeGridWeek-button fc-button fc-button-primary ${
                    viewMode === 'week' ? 'fc-button-active' : ''
                  }`}
                >
                  Semaine
                </button>
                <button
                  type="button"
                  title="Jour"
                  aria-pressed={viewMode === 'day'}
                  onClick={() => setViewMode('day')}
                  className={`fc-timeGridDay-button fc-button fc-button-primary ${
                    viewMode === 'day' ? 'fc-button-active' : ''
                  }`}
                >
                  Jour
                </button>
                <button
                  type="button"
                  title="Liste"
                  aria-pressed={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                  className={`fc-listWeek-button fc-button fc-button-primary ${
                    viewMode === 'list' ? 'fc-button-active' : ''
                  }`}
                >
                  Liste
                </button>
              </div>
            </div>
          </div>

          {/* View Harness */}
          <div aria-labelledby="fc-dom-1" className="fc-view-harness fc-view-harness-passive">
            {/* VIEW 1: MONTH (FullCalendar DayGrid Month View) */}
            {viewMode === 'month' && (
              <div className="fc-daygrid fc-dayGridMonth-view fc-view overflow-x-auto">
                <table role="grid" className="fc-scrollgrid min-w-[750px]">
                  <thead role="rowgroup">
                    <tr role="presentation" className="fc-scrollgrid-section fc-scrollgrid-section-header">
                      <th role="columnheader" className="fc-col-header-cell fc-day fc-day-mon">
                        lun.
                      </th>
                      <th role="columnheader" className="fc-col-header-cell fc-day fc-day-tue">
                        mar.
                      </th>
                      <th role="columnheader" className="fc-col-header-cell fc-day fc-day-wed">
                        mer.
                      </th>
                      <th role="columnheader" className="fc-col-header-cell fc-day fc-day-thu">
                        jeu.
                      </th>
                      <th role="columnheader" className="fc-col-header-cell fc-day fc-day-fri">
                        ven.
                      </th>
                      <th role="columnheader" className="fc-col-header-cell fc-day fc-day-sat">
                        sam.
                      </th>
                      <th role="columnheader" className="fc-col-header-cell fc-day fc-day-sun">
                        dim.
                      </th>
                    </tr>
                  </thead>

                  <tbody role="rowgroup">
                    {Array.from({ length: 6 }).map((_, weekIdx) => {
                      const weekCells = monthDays.slice(weekIdx * 7, (weekIdx + 1) * 7);
                      return (
                        <tr key={weekIdx} role="row">
                          {weekCells.map((dayItem) => {
                            const isOtherMonth = !dayItem.isCurrentMonth;
                            const isToday = dayItem.isToday;

                            return (
                              <td
                                key={dayItem.dateStr}
                                role="gridcell"
                                onClick={() => handleDayClick(dayItem.dateStr)}
                                className={`fc-daygrid-day group cursor-pointer p-1.5 transition-colors ${
                                  isOtherMonth ? 'fc-day-other' : ''
                                } ${isToday ? 'fc-day-today' : ''}`}
                                data-date={dayItem.dateStr}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="fc-daygrid-day-number">
                                    {dayItem.dayNumber}
                                  </span>
                                  {isToday && (
                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mr-1">
                                      Aujourd'hui
                                    </span>
                                  )}
                                </div>

                                {/* Appointment event pills */}
                                <div className="mt-1 space-y-1 min-h-[50px]">
                                  {dayItem.appointments.slice(0, 3).map((apt) => {
                                    const timeStr = new Date(apt.startsAt).toLocaleTimeString('fr-FR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    });

                                    const isCardio = apt.serviceCode === 'CARDIO';
                                    const isArrived = apt.status === 'arrived';
                                    const isCompleted = apt.status === 'completed';

                                    return (
                                      <div
                                        key={apt.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAppointment(apt);
                                        }}
                                        className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition-all shadow-2xs hover:scale-102 ${
                                          isArrived
                                            ? 'bg-amber-100 text-amber-900 border-l-2 border-amber-600 dark:bg-amber-950/70 dark:text-amber-200'
                                            : isCompleted
                                            ? 'bg-emerald-50 text-emerald-800 border-l-2 border-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-200 opacity-80'
                                            : isCardio
                                            ? 'bg-indigo-50 text-indigo-900 border-l-2 border-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-200'
                                            : 'bg-blue-50 text-blue-900 border-l-2 border-blue-600 dark:bg-blue-950/70 dark:text-blue-200'
                                        }`}
                                      >
                                        <span className="font-mono font-bold mr-1">{timeStr}</span>
                                        <span>{apt.patientName}</span>
                                      </div>
                                    );
                                  })}

                                  {dayItem.appointments.length > 3 && (
                                    <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 pl-1">
                                      +{dayItem.appointments.length - 3} autres...
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* VIEW 2: WEEK (TimeGrid Week View) */}
            {viewMode === 'week' && (
              <div className="fc-timegrid fc-timeGridWeek-view overflow-x-auto">
                <table className="fc-scrollgrid min-w-[850px]">
                  <thead>
                    <tr>
                      <th className="fc-col-header-cell w-20 text-xs">Heure</th>
                      {weekDays.map((wd) => (
                        <th key={wd.dateStr} className="fc-col-header-cell capitalize text-xs">
                          {wd.dayLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map(
                      (hour) => (
                        <tr key={hour} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="p-2 font-mono text-xs text-slate-500 dark:text-slate-400 text-center bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-100 dark:border-slate-800">
                            {hour}
                          </td>
                          {weekDays.map((wd) => {
                            const aptsInSlot = wd.appointments.filter((a) => {
                              const aptTime = new Date(a.startsAt).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                              return aptTime.startsWith(hour.substring(0, 2));
                            });

                            return (
                              <td
                                key={`${wd.dateStr}_${hour}`}
                                onClick={() => {
                                  setAppointmentDate(wd.dateStr);
                                  setStartTime(hour);
                                  setIsCreateOpen(true);
                                }}
                                className="p-1 border-r border-slate-100 dark:border-slate-800 min-h-[50px] align-top hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                              >
                                {aptsInSlot.map((apt) => (
                                  <div
                                    key={apt.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedAppointment(apt);
                                    }}
                                    className="rounded p-1.5 text-xs bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200 border-l-2 border-blue-600 mb-1"
                                  >
                                    <div className="font-semibold">{apt.patientName}</div>
                                    <div className="text-[10px] text-slate-600 dark:text-slate-400">
                                      {apt.reason} · {apt.roomCode}
                                    </div>
                                  </div>
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* VIEW 3: DAY (Timeline & Queue) */}
            {viewMode === 'day' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      Planning du jour : {currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {filteredAppointments.filter((a) => a.startsAt.startsWith(currentDate.toISOString().split('T')[0])).length} consultation(s)
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAppointments
                    .filter((a) => a.startsAt.startsWith(currentDate.toISOString().split('T')[0]))
                    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                    .map((apt) => {
                      const startTimeStr = new Date(apt.startsAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const endTimeStr = new Date(apt.endsAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={apt.id}
                          className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 p-3 rounded-xl transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-center">
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                                {startTimeStr}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                {endTimeStr}
                              </span>
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                  {apt.patientName}
                                </span>
                                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                  {apt.patientMrn}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    apt.status === 'arrived'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                      : apt.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  }`}
                                >
                                  {apt.status === 'arrived' ? 'En salle d\'attente' : apt.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                {apt.reason} · Salle {apt.roomCode} · Praticien: {apt.practitionerName}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              onClick={() => onOpenConsultationForPatient(apt.patientId)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs"
                            >
                              <Play className="h-3 w-3 fill-current" />
                              <span>Consulter</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* VIEW 4: LIST (Agenda List View) */}
            {viewMode === 'list' && (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Date & Heure</th>
                        <th className="p-3">Patient (IPP)</th>
                        <th className="p-3">Praticien</th>
                        <th className="p-3">Motif de consultation</th>
                        <th className="p-3">Salle</th>
                        <th className="p-3">Statut</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAppointments
                        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                        .map((apt) => {
                          const dateStr = new Date(apt.startsAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          });
                          const timeStr = new Date(apt.startsAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          });

                          return (
                            <tr
                              key={apt.id}
                              onClick={() => setSelectedAppointment(apt)}
                              className="hover:bg-slate-50 dark:hover:bg-slate-850/60 cursor-pointer transition-colors"
                            >
                              <td className="p-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                                {dateStr} {timeStr}
                              </td>
                              <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                                {apt.patientName}
                                <span className="block font-mono text-[10px] text-slate-500">
                                  {apt.patientMrn}
                                </span>
                              </td>
                              <td className="p-3 text-slate-700 dark:text-slate-300">
                                {apt.practitionerName}
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-400">
                                {apt.reason}
                              </td>
                              <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                                {apt.roomCode}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    apt.status === 'arrived'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                      : apt.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  }`}
                                >
                                  {apt.status}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenConsultationForPatient(apt.patientId);
                                  }}
                                  className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 px-2 py-1 text-xs font-semibold"
                                >
                                  <span>Consulter</span>
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Appointment Detail Modal / Popover */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                  <Calendar className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Détail du Rendez-vous
                </h3>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Patient</span>
                <p className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedAppointment.patientName}
                </p>
                <p className="font-mono text-xs text-slate-500">
                  {selectedAppointment.patientMrn}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                  <span className="text-[10px] text-slate-500 uppercase">Horaire</span>
                  <p className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {new Date(selectedAppointment.startsAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    -{' '}
                    {new Date(selectedAppointment.endsAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(selectedAppointment.startsAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                  <span className="text-[10px] text-slate-500 uppercase">Lieu & Salle</span>
                  <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    Salle {selectedAppointment.roomCode}
                  </p>
                  <p className="text-[10px] text-slate-500">Cabinet Médical</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                <span className="text-[10px] text-slate-500 uppercase">Motif de consultation</span>
                <p className="text-slate-800 dark:text-slate-200 mt-0.5 font-medium">
                  {selectedAppointment.reason}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Praticien référent : {selectedAppointment.practitionerName}
                </p>
              </div>

              {/* Status Changer */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Modifier le statut
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(['confirmed', 'arrived', 'in_progress', 'completed', 'cancelled'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => {
                          onUpdateAppointmentStatus(selectedAppointment.id, st);
                          setSelectedAppointment({
                            ...selectedAppointment,
                            status: st,
                          });
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                          selectedAppointment.status === st
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {st === 'arrived' ? 'En salle' : st}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                onClick={() => setSelectedAppointment(null)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Fermer
              </button>

              <button
                onClick={() => {
                  const patId = selectedAppointment.patientId;
                  setSelectedAppointment(null);
                  onOpenConsultationForPatient(patId);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white shadow-xs"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Ouvrir la consultation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Creation Form Modal ("et de formulaire") */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                  <Plus className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Formulaire de Rendez-vous Clinique
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Vérification dynamique de conflit et enregistrement dans l'Outbox
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              {/* Dynamic Clickable Patient Search & Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Sélection du Patient *
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    placeholder="Filtrer les patients par nom, prénom ou IPP..."
                    value={patientSearchQuery}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 mb-1.5 focus:border-blue-500 focus:outline-hidden"
                  />
                  <div className="max-h-32 overflow-y-auto space-y-1 rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-850">
                    {filteredPatients.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setPatientId(p.id)}
                        className={`flex items-center justify-between rounded-lg p-1.5 text-xs cursor-pointer transition-colors ${
                          patientId === p.id
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>
                          {p.familyName.toUpperCase()} {p.givenName}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {p.medicalRecordNumber}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Practitioner selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Médecin Praticien *
                </label>
                <select
                  value={targetPractitionerId}
                  onChange={(e) => setTargetPractitionerId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                >
                  {practitioners.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.displayName} ({doc.department})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date, Time, Duration */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Heure début *
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Durée
                  </label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-medium"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </div>
              </div>

              {/* Type & Room */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Type de consultation
                  </label>
                  <select
                    value={appointmentType}
                    onChange={(e) =>
                      setAppointmentType(e.target.value as Appointment['appointmentType'])
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  >
                    <option value="consultation">Consultation standard</option>
                    <option value="suivi">Suivi chronique</option>
                    <option value="urgence">Urgence relative</option>
                    <option value="teleconsultation">Téléconsultation</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Salle / Box
                  </label>
                  <select
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  >
                    <option value="Box 1">Box 1 (Dr. Martin)</option>
                    <option value="Box 2">Box 2 (Dr. Lefèvre - Cardio)</option>
                    <option value="Box 3">Box 3 (Dr. Benali - Pneumo)</option>
                    <option value="Salle Soins">Salle de soins IDE</option>
                  </select>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Motif de consultation *
                </label>
                <input
                  type="text"
                  value={appointmentReason}
                  onChange={(e) => setAppointmentReason(e.target.value)}
                  placeholder="Ex: Contrôle tensionnel, bilan annuel, crise d'asthme..."
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs"
                >
                  Valider le Rendez-vous
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collision Alert Dialog */}
      {conflictResult?.hasConflict && conflictResult.conflictingAppointment && requestedSlot && (
        <AppointmentConflictDialog
          isOpen={true}
          onClose={() => {
            setConflictResult(null);
            setRequestedSlot(null);
          }}
          conflictingAppointment={conflictResult.conflictingAppointment}
          requestedSlot={requestedSlot}
          suggestedSlots={conflictResult.suggestedSlots || []}
          onSelectAlternative={(slot) => {
            const startObj = new Date(slot.startsAt);
            setAppointmentDate(slot.startsAt.split('T')[0]);
            setStartTime(
              startObj.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })
            );
            setConflictResult(null);
            setRequestedSlot(null);
          }}
        />
      )}
    </div>
  );
};

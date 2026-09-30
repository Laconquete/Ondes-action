import { useState, useMemo, useCallback } from 'react';
import { Appointment, QueueTicket, AppUser, Patient } from '../types/clinical';

/**
 * useReceptionQueue — Gère la file d'attente de la réception.
 *
 * Fonctionnalités :
 *  - Tri dynamique par colonne (clique sur l'en-tête)
 *  - Filtre par statut / médecin / priorité / recherche texte
 *  - Statistiques temps réel (nombre en attente, temps moyen, etc.)
 *  - Orientation des patients vers un médecin (drag & drop ou bouton)
 *  - Walk-in : création d'un patient sans RDV
 *
 * Le hook est purement présentationnel — il ne modifie pas les données
 * (ça reste dans usePatientData). Il expose juste des handlers.
 */

export type SortColumn = 'patientName' | 'arrivedAt' | 'priority' | 'status' | 'practitionerName';
export type SortDirection = 'asc' | 'desc';
export type StatusFilter = 'all' | 'waiting' | 'called' | 'in_room' | 'completed' | 'cancelled';
export type PriorityFilter = 'all' | 'urgent' | 'important' | 'normal';

export interface ReceptionQueueRow {
  ticket: QueueTicket;
  appointment?: Appointment;
  patient?: Patient;
  waitingTimeMs: number; // Temps d'attente en millisecondes
  waitingTimeLabel: string; // "5 min", "1h 23min"
  isOverdue: boolean; // Si le RDV était à 10:30 et qu'il est 10:45 → overdue
}

export interface ReceptionStats {
  total: number;
  waiting: number;
  inRoom: number;
  completed: number;
  urgent: number;
  avgWaitTimeLabel: string;
  longestWaitLabel: string;
}

interface UseReceptionQueueOptions {
  queueTickets: QueueTicket[];
  appointments: Appointment[];
  patients: Patient[];
  doctors: AppUser[];
  onCallTicket?: (ticketId: string) => void;
  onAssignDoctor?: (ticketId: string, doctorId: string, doctorName: string) => void;
  onCheckIn?: (params: {
    patient: Patient;
    targetDoctorId: string;
    targetDoctorName: string;
    roomCode: string;
    reason: string;
    priority: number;
  }) => void;
}

interface ReceptionQueueState {
  // Données dérivées
  rows: ReceptionQueueRow[];
  stats: ReceptionStats;

  // Tri
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  setSortColumn: (col: SortColumn) => void;
  toggleSort: (col: SortColumn) => void;

  // Filtres
  statusFilter: StatusFilter;
  setStatusFilter: (f: StatusFilter) => void;
  priorityFilter: PriorityFilter;
  setPriorityFilter: (f: PriorityFilter) => void;
  doctorFilter: string; // doctorId or 'all'
  setDoctorFilter: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Handlers
  handleCallTicket: (ticketId: string) => void;
  handleAssignDoctor: (ticketId: string, doctor: AppUser) => void;
  clearFilters: () => void;

  // Disponibilité des médecins
  doctorAvailability: Array<{
    doctor: AppUser;
    patientsInRoom: number;
    patientsWaiting: number;
    isAvailable: boolean;
  }>;
}

const ROOMS = ['Box 1', 'Box 2', 'Box 3', 'Salle Urgence', 'Salle Consultation'];

function formatWaitingTime(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}min`;
}

function isOverdue(appointment: Appointment | undefined, ticket: QueueTicket): boolean {
  if (!appointment) return false;
  const now = Date.now();
  const apptTime = new Date(appointment.startsAt).getTime();
  // Si le RDV était il y a plus de 10 minutes et que le patient est encore en attente
  return now - apptTime > 10 * 60 * 1000 && ticket.status === 'waiting';
}

export function useReceptionQueue({
  queueTickets,
  appointments,
  patients,
  doctors,
  onCallTicket,
  onAssignDoctor,
}: UseReceptionQueueOptions): ReceptionQueueState {
  const [sortColumn, setSortColumn] = useState<SortColumn>('arrivedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const now = Date.now();

  // Construire les lignes du tableau
  const allRows: ReceptionQueueRow[] = useMemo(() => {
    return queueTickets.map((ticket) => {
      const appointment = appointments.find((a) => a.id === ticket.appointmentId);
      const patient = patients.find((p) => p.id === ticket.patientId);
      const waitingTimeMs = now - new Date(ticket.arrivedAt).getTime();
      return {
        ticket,
        appointment,
        patient,
        waitingTimeMs,
        waitingTimeLabel: formatWaitingTime(waitingTimeMs),
        isOverdue: isOverdue(appointment, ticket),
      };
    });
  }, [queueTickets, appointments, patients, now]);

  // Statistiques
  const stats: ReceptionStats = useMemo(() => {
    const waiting = allRows.filter((r) => r.ticket.status === 'waiting');
    const completed = allRows.filter((r) => r.ticket.status === 'completed');
    const urgent = allRows.filter((r) => r.ticket.priority >= 2);
    const inRoom = allRows.filter((r) => r.ticket.status === 'in_room');

    const waitTimes = waiting.map((r) => r.waitingTimeMs);
    const avgWait = waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;
    const longestWait = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;

    return {
      total: allRows.length,
      waiting: waiting.length,
      inRoom: inRoom.length,
      completed: completed.length,
      urgent: urgent.length,
      avgWaitTimeLabel: avgWait > 0 ? formatWaitingTime(avgWait) : '—',
      longestWaitLabel: longestWait > 0 ? formatWaitingTime(longestWait) : '—',
    };
  }, [allRows]);

  // Disponibilité des médecins
  const doctorAvailability = useMemo(() => {
    return doctors
      .filter((d) => d.role === 'doctor' || d.role === 'medical_director')
      .map((doctor) => {
        const doctorAppts = appointments.filter((a) => a.practitionerId === doctor.id);
        const doctorTickets = allRows.filter((r) =>
          r.appointment?.practitionerId === doctor.id
        );
        const patientsInRoom = doctorTickets.filter((r) => r.ticket.status === 'in_room').length;
        const patientsWaiting = doctorTickets.filter((r) => r.ticket.status === 'waiting').length;
        return {
          doctor,
          patientsInRoom,
          patientsWaiting,
          isAvailable: patientsInRoom === 0,
        };
      });
  }, [doctors, appointments, allRows]);

  // Filtrer
  const filteredRows = useMemo(() => {
    let result = allRows;

    // Filtre statut
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.ticket.status === statusFilter);
    }

    // Filtre priorité
    if (priorityFilter !== 'all') {
      if (priorityFilter === 'urgent') result = result.filter((r) => r.ticket.priority >= 2);
      else if (priorityFilter === 'important') result = result.filter((r) => r.ticket.priority === 1);
      else if (priorityFilter === 'normal') result = result.filter((r) => r.ticket.priority === 0);
    }

    // Filtre médecin
    if (doctorFilter !== 'all') {
      result = result.filter((r) => r.appointment?.practitionerId === doctorFilter);
    }

    // Recherche texte
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) =>
        r.ticket.patientName.toLowerCase().includes(q) ||
        (r.patient?.medicalRecordNumber || '').toLowerCase().includes(q) ||
        (r.appointment?.reason || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [allRows, statusFilter, priorityFilter, doctorFilter, searchQuery]);

  // Trier
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'patientName':
          cmp = a.ticket.patientName.localeCompare(b.ticket.patientName);
          break;
        case 'arrivedAt':
          cmp = new Date(a.ticket.arrivedAt).getTime() - new Date(b.ticket.arrivedAt).getTime();
          break;
        case 'priority':
          cmp = b.ticket.priority - a.ticket.priority; // Priorité haute d'abord
          break;
        case 'status':
          cmp = a.ticket.status.localeCompare(b.ticket.status);
          break;
        case 'practitionerName':
          cmp = (a.appointment?.practitionerName || '').localeCompare(b.appointment?.practitionerName || '');
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    // Les patients overdue toujours en haut, peu importe le tri
    sorted.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return 0;
    });

    return sorted;
  }, [filteredRows, sortColumn, sortDirection]);

  const toggleSort = useCallback((col: SortColumn) => {
    setSortColumn((prevCol) => {
      if (prevCol === col) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return prevCol;
      }
      setSortDirection('asc');
      return col;
    });
  }, []);

  const handleCallTicket = useCallback((ticketId: string) => {
    onCallTicket?.(ticketId);
  }, [onCallTicket]);

  const handleAssignDoctor = useCallback((ticketId: string, doctor: AppUser) => {
    onAssignDoctor?.(ticketId, doctor.id, doctor.displayName);
  }, [onAssignDoctor]);

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setDoctorFilter('all');
    setSearchQuery('');
  }, []);

  return {
    rows: sortedRows,
    stats,
    sortColumn,
    sortDirection,
    setSortColumn,
    toggleSort,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    doctorFilter,
    setDoctorFilter,
    searchQuery,
    setSearchQuery,
    handleCallTicket,
    handleAssignDoctor,
    clearFilters,
    doctorAvailability,
  };
}

export { ROOMS };

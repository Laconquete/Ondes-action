import React, { useState, useRef } from 'react';
import {
  Search,
  Clock,
  AlertTriangle,
  UserCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Plus,
  Users,
  Stethoscope,
  Calendar,
} from 'lucide-react';
import { Appointment, QueueTicket, AppUser, Patient } from '../types/clinical';
import {
  useReceptionQueue,
  SortColumn,
  StatusFilter,
  PriorityFilter,
  ROOMS,
} from '../hooks/useReceptionQueue';

interface ReceptionDashboardProps {
  queueTickets: QueueTicket[];
  appointments: Appointment[];
  patients: Patient[];
  doctors: AppUser[];
  currentUser: AppUser;
  onCallTicket: (ticketId: string) => void;
  onAssignDoctor: (ticketId: string, doctorId: string, doctorName: string) => void;
  onCheckIn: (params: {
    patient: Patient;
    targetDoctorId: string;
    targetDoctorName: string;
    roomCode: string;
    reason: string;
    priority: number;
  }) => void;
  onAddPatient?: (patient: Patient) => void;
  onClose?: () => void;
}

/**
 * ReceptionDashboard — Tableau de bord dynamique de la réception.
 *
 * Fonctionnalités :
 *  - Datagrid avec tri par colonne (clic sur l'en-tête)
 *  - Filtres : statut, priorité, médecin, recherche texte
 *  - Drag & drop : glisser un patient vers un médecin pour l'orienter
 *  - Lignes cliquables : ouvrir le détail / appeler le patient
 *  - Statistiques temps réel (en attente, en consultation, temps moyen)
 *  - Panneau de disponibilité des médecins (glisser-déposer ici)
 *  - Walk-in : bouton pour créer un patient sans RDV
 *  - Alertes visuelles : patients en retard (overdue) en rouge
 *
 * Extrait dans un composant dédié pour remplacer le modal basic actuel.
 */
export const ReceptionDashboard: React.FC<ReceptionDashboardProps> = ({
  queueTickets,
  appointments,
  patients,
  doctors,
  currentUser,
  onCallTicket,
  onAssignDoctor,
  onCheckIn,
  onAddPatient,
  onClose,
}) => {
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [dragOverDoctorId, setDragOverDoctorId] = useState<string | null>(null);

  const {
    rows,
    stats,
    sortColumn,
    sortDirection,
    toggleSort,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    doctorFilter,
    setDoctorFilter,
    searchQuery,
    setSearchQuery,
    clearFilters,
    doctorAvailability,
  } = useReceptionQueue({
    queueTickets,
    appointments,
    patients,
    doctors,
    onCallTicket,
    onAssignDoctor,
  });

  // === Handlers Drag & Drop ===
  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    setDraggedTicketId(ticketId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ticketId);
  };

  const handleDragOver = (e: React.DragEvent, doctorId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDoctorId(doctorId);
  };

  const handleDragLeave = () => {
    setDragOverDoctorId(null);
  };

  const handleDrop = (e: React.DragEvent, doctor: AppUser) => {
    e.preventDefault();
    if (draggedTicketId) {
      onAssignDoctor(draggedTicketId, doctor.id, doctor.displayName);
    }
    setDraggedTicketId(null);
    setDragOverDoctorId(null);
  };

  const priorityBadge = (priority: number) => {
    if (priority >= 2) return { label: 'URGENT', className: 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800' };
    if (priority === 1) return { label: 'IMPORTANT', className: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800' };
    return { label: 'Normal', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'waiting': return { label: 'En attente', className: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300' };
      case 'called': return { label: 'Appelé', className: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300' };
      case 'in_room': return { label: 'En consultation', className: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' };
      case 'completed': return { label: 'Terminé', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' };
      case 'cancelled': return { label: 'Annulé', className: 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300' };
      default: return { label: status, className: 'bg-slate-100 dark:bg-slate-800 text-slate-600' };
    }
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3 w-3 text-slate-300 dark:text-slate-600" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />;
  };

  return (
    <div className="space-y-4">
      {/* === EN-TÊTE : Statistiques + actions === */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-clinical">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Réception — File d'attente
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {stats.waiting} en attente · {stats.inRoom} en consultation · {stats.completed} terminés
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-slate-500 dark:text-slate-400">Attente moy.</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">{stats.avgWaitTimeLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-slate-500 dark:text-slate-400">Plus longue</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">{stats.longestWaitLabel}</span>
          </div>
          {stats.urgent > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 animate-pulse">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-bold">{stats.urgent} URGENT</span>
            </div>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* === BARRE DE FILTRES === */}
      <div className="flex flex-wrap items-center gap-2 p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, IPP, motif..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Filtre statut */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
        >
          <option value="all">Tous statuts</option>
          <option value="waiting">En attente</option>
          <option value="called">Appelé</option>
          <option value="in_room">En consultation</option>
          <option value="completed">Terminé</option>
          <option value="cancelled">Annulé</option>
        </select>

        {/* Filtre priorité */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
          className="px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
        >
          <option value="all">Toutes priorités</option>
          <option value="urgent">Urgent</option>
          <option value="important">Important</option>
          <option value="normal">Normal</option>
        </select>

        {/* Filtre médecin */}
        <select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
        >
          <option value="all">Tous médecins</option>
          {doctors.filter((d) => d.role === 'doctor' || d.role === 'medical_director').map((doc) => (
            <option key={doc.id} value={doc.id}>{doc.displayName}</option>
          ))}
        </select>

        {/* Réinitialiser */}
        {(statusFilter !== 'all' || priorityFilter !== 'all' || doctorFilter !== 'all' || searchQuery) && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-3 w-3" />
            Effacer
          </button>
        )}

        {/* Walk-in */}
        <button
          onClick={() => setShowWalkIn(true)}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ml-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Walk-in
        </button>
      </div>

      {/* === PANNEAU MÉDECINS DISPONIBLES (drop zone) === */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Stethoscope className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Médecins disponibles — Glissez un patient ici
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {doctorAvailability.map(({ doctor, patientsInRoom, patientsWaiting, isAvailable }) => (
            <div
              key={doctor.id}
              onDragOver={(e) => handleDragOver(e, doctor.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, doctor)}
              className={`flex items-center gap-2 px-3 py-2 border-2 transition-all ${
                dragOverDoctorId === doctor.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 scale-105'
                  : isAvailable
                  ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
              }`}
            >
              <div className="flex h-7 w-7 items-center justify-center bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                {doctor.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="text-left">
                <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100">{doctor.displayName}</div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400">
                  {isAvailable ? '✓ Disponible' : `${patientsInRoom} en salle · ${patientsWaiting} en attente`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === DATAGRID === */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-clinical overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-2.5 w-8"></th>
                <th
                  onClick={() => toggleSort('patientName')}
                  className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1">Patient <SortIcon col="patientName" /></div>
                </th>
                <th
                  onClick={() => toggleSort('arrivedAt')}
                  className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1">Arrivée <SortIcon col="arrivedAt" /></div>
                </th>
                <th className="px-3 py-2.5">Attente</th>
                <th className="px-3 py-2.5">Motif</th>
                <th
                  onClick={() => toggleSort('practitionerName')}
                  className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1">Médecin <SortIcon col="practitionerName" /></div>
                </th>
                <th
                  onClick={() => toggleSort('priority')}
                  className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1">Priorité <SortIcon col="priority" /></div>
                </th>
                <th
                  onClick={() => toggleSort('status')}
                  className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1">Statut <SortIcon col="status" /></div>
                </th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400 dark:text-slate-600">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Aucun patient dans la file d'attente.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const pri = priorityBadge(row.ticket.priority);
                  const st = statusBadge(row.ticket.status);
                  return (
                    <tr
                      key={row.ticket.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, row.ticket.id)}
                      className={`cursor-move hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors ${
                        row.isOverdue ? 'bg-red-50/30 dark:bg-red-950/20' : ''
                      } ${draggedTicketId === row.ticket.id ? 'opacity-40' : ''}`}
                    >
                      <td className="px-3 py-3 text-slate-300 dark:text-slate-600">
                        <div className="flex flex-col gap-0.5 items-center">
                          <div className="h-1 w-1 rounded-full bg-current"></div>
                          <div className="h-1 w-1 rounded-full bg-current"></div>
                          <div className="h-1 w-1 rounded-full bg-current"></div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {row.ticket.patientName}
                        </div>
                        {row.patient && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {row.patient.medicalRecordNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {new Date(row.ticket.arrivedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`font-mono font-bold tabular-nums ${row.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {row.waitingTimeLabel}
                        </span>
                        {row.isOverdue && (
                          <span className="ml-1 text-[9px] font-bold text-red-600 dark:text-red-400">⚠ Retard</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                        {row.appointment?.reason || 'Walk-in'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {row.appointment?.practitionerName ? (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-semibold">
                            {row.appointment.practitionerName.replace('Dr. ', '')}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Non assigné</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold border ${pri.className}`}>
                          {pri.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold ${st.className}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {row.ticket.status === 'waiting' && (
                          <button
                            onClick={() => onCallTicket(row.ticket.id)}
                            className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 text-[10px] font-bold transition-colors cursor-pointer"
                            title="Appeler le patient en salle"
                          >
                            <UserCheck className="h-3 w-3" />
                            Appeler
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* === Dialogue Walk-in === */}
      {showWalkIn && (
        <WalkInDialog
          patients={patients}
          doctors={doctors.filter((d) => d.role === 'doctor' || d.role === 'medical_director')}
          onCheckIn={onCheckIn}
          onAddPatient={onAddPatient}
          onClose={() => setShowWalkIn(false)}
        />
      )}
    </div>
  );
};

// === Dialogue Walk-in : enregistrement d'un patient (existant OU nouveau) sans RDV ===
const WalkInDialog: React.FC<{
  patients: Patient[];
  doctors: AppUser[];
  onCheckIn: (params: {
    patient: Patient;
    targetDoctorId: string;
    targetDoctorName: string;
    roomCode: string;
    reason: string;
    priority: number;
  }) => void;
  onAddPatient?: (patient: Patient) => void;
  onClose: () => void;
}> = ({ patients, doctors, onCheckIn, onAddPatient, onClose }) => {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<AppUser | null>(null);
  const [roomCode, setRoomCode] = useState(ROOMS[0]);
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState(0);

  // Champs nouveau patient
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newGivenName, setNewGivenName] = useState('');
  const [newBirthDate, setNewBirthDate] = useState('');
  const [newGender, setNewGender] = useState<'M' | 'F' | 'O'>('M');
  const [newPhone, setNewPhone] = useState('');

  const filteredPatients = patients.filter((p) =>
    searchTerm.trim() === '' ||
    `${p.familyName} ${p.givenName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.medicalRecordNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRegister = () => {
    if (mode === 'existing' && selectedPatient && selectedDoctor && reason.trim()) {
      onCheckIn({
        patient: selectedPatient,
        targetDoctorId: selectedDoctor.id,
        targetDoctorName: selectedDoctor.displayName,
        roomCode,
        reason: reason.trim(),
        priority,
      });
      onClose();
    } else if (mode === 'new' && newFamilyName.trim() && newGivenName.trim() && selectedDoctor && reason.trim() && onAddPatient) {
      // Créer un nouveau patient
      const newPatient: Patient = {
        id: `pat_new_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        medicalRecordNumber: `MRN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
        familyName: newFamilyName.trim(),
        givenName: newGivenName.trim(),
        birthDate: newBirthDate || '1990-01-01',
        gender: newGender,
        phone: newPhone.trim(),
        email: '',
        address: { street: '', city: '', postalCode: '' },
        bloodGroup: '',
        emergencyContact: { name: '', relationship: '', phone: '' },
        insurance: { provider: '', policyNumber: '' },
        allergies: [],
        problems: [],
        vitalsHistory: [],
        medicalHistory: [],
        riskFactors: [],
        status: 'active',
      };
      onAddPatient(newPatient);

      // Puis enregistrer dans la file d'attente
      onCheckIn({
        patient: newPatient,
        targetDoctorId: selectedDoctor.id,
        targetDoctorName: selectedDoctor.displayName,
        roomCode,
        reason: reason.trim(),
        priority,
      });
      onClose();
    }
  };

  const canRegister = mode === 'existing'
    ? selectedPatient && selectedDoctor && reason.trim()
    : newFamilyName.trim() && newGivenName.trim() && selectedDoctor && reason.trim() && onAddPatient;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto animate-fadeInScale">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Walk-in — Enregistrer un patient
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Toggle: Patient existant OU Nouveau */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('existing')}
              className={`flex-1 py-2 text-xs font-bold border-2 transition-all ${
                mode === 'existing'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
              }`}
            >
              👤 Patient existant
            </button>
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-2 text-xs font-bold border-2 transition-all ${
                mode === 'new'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
              }`}
            >
              ✨ Nouveau patient
            </button>
          </div>

          {/* === MODE: Patient existant === */}
          {mode === 'existing' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Rechercher le patient
              </label>
              {selectedPatient ? (
                <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {selectedPatient.familyName} {selectedPatient.givenName}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {selectedPatient.medicalRecordNumber}
                    </div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} className="text-slate-400 hover:text-red-500 text-xs">
                    Changer
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher par nom ou IPP..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                  {searchTerm && (
                    <div className="mt-1.5 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800">
                      {filteredPatients.length === 0 ? (
                        <div className="p-3 text-center text-[11px] text-slate-400">
                          Aucun patient trouvé. Utilisez l'onglet "Nouveau patient".
                        </div>
                      ) : (
                        filteredPatients.slice(0, 10).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedPatient(p)}
                            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
                          >
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {p.familyName} {p.givenName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">{p.medicalRecordNumber}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* === MODE: Nouveau patient === */}
          {mode === 'new' && (
            <div className="space-y-3 p-3 border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Créer un nouveau dossier patient
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Nom *</label>
                  <input
                    type="text"
                    value={newFamilyName}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                    placeholder="ex: Mukendi"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Prénom *</label>
                  <input
                    type="text"
                    value={newGivenName}
                    onChange={(e) => setNewGivenName(e.target.value)}
                    placeholder="ex: Grâce"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Naissance</label>
                  <input
                    type="date"
                    value={newBirthDate}
                    onChange={(e) => setNewBirthDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Genre</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value as 'M' | 'F' | 'O')}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="M">M</option>
                    <option value="F">F</option>
                    <option value="O">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Téléphone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+243 ..."
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[9px] text-slate-400 dark:text-slate-500">
                L'IPP (Identifiant Patient Permanent) sera généré automatiquement.
              </p>
            </div>
          )}

          {/* Sélection médecin — commun aux deux modes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Orienter vers le médecin
            </label>
            <div className="flex flex-wrap gap-2">
              {doctors.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoctor(doc)}
                  className={`flex items-center gap-2 px-3 py-2 border-2 transition-all ${
                    selectedDoctor?.id === doc.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex h-6 w-6 items-center justify-center bg-slate-100 dark:bg-slate-700 text-[9px] font-bold text-slate-700 dark:text-slate-200">
                    {doc.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">{doc.displayName}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Salle + motif + priorité */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">Salle</label>
              <select
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                {ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">Priorité</label>
              <select
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value={0}>Normal</option>
                <option value={1}>Important</option>
                <option value={2}>Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">Motif de la visite</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ex: Douleur thoracique, contrôle tension, fièvre..."
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleRegister}
            disabled={!canRegister}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 text-xs font-bold transition-colors"
          >
            ✓ {mode === 'new' ? 'Créer le patient + Enregistrer' : 'Enregistrer dans la file d\'attente'}
          </button>
        </div>
      </div>
    </div>
  );
};

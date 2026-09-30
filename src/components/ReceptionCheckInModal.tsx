import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Search,
  UserPlus,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
  X,
  ArrowRight,
  ShieldCheck,
  Ticket,
  Bell,
  Sparkles,
  Phone,
  FileText,
  User,
} from 'lucide-react';
import { Patient, Appointment, AppUser, QueueTicket, DoctorNotification } from '../types/clinical';

interface ReceptionCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  appointments: Appointment[];
  doctors: AppUser[];
  onCheckInPatient: (params: {
    patient: Patient;
    appointmentId?: string;
    targetDoctorId: string;
    targetDoctorName: string;
    roomCode: string;
    reason: string;
    isWalkIn: boolean;
    priority: number;
  }) => void;
  onAddNewPatientAndCheckIn: (
    newPatient: Patient,
    checkInParams: {
      targetDoctorId: string;
      targetDoctorName: string;
      roomCode: string;
      reason: string;
      priority: number;
    }
  ) => void;
}

export const ReceptionCheckInModal: React.FC<ReceptionCheckInModalProps> = ({
  isOpen,
  onClose,
  patients,
  appointments,
  doctors,
  onCheckInPatient,
  onAddNewPatientAndCheckIn,
}) => {
  if (!isOpen) return null;

  // Search query for patient at reception
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // New patient mode if not found
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newGivenName, setNewGivenName] = useState('');
  const [newBirthDate, setNewBirthDate] = useState('1990-01-01');
  const [newGender, setNewGender] = useState<'M' | 'F' | 'O'>('M');
  const [newPhone, setNewPhone] = useState('');
  const [newDoctorId, setNewDoctorId] = useState(doctors[0]?.id || '');
  const [newReason, setNewReason] = useState('Consultation médicale');

  // Walk-in options for existing patient without appointment
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [walkInReason, setWalkInReason] = useState('Consultation sans rendez-vous');
  const [walkInPriority, setWalkInPriority] = useState<number>(0);
  const [roomCode, setRoomCode] = useState('Box 1');

  // Success state with generated ticket
  const [confirmedArrival, setConfirmedArrival] = useState<{
    patientName: string;
    ticketNumber: string;
    doctorName: string;
    room: string;
    time: string;
  } | null>(null);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return patients.filter(
      (p) =>
        p.familyName.toLowerCase().includes(q) ||
        p.givenName.toLowerCase().includes(q) ||
        p.medicalRecordNumber.toLowerCase().includes(q) ||
        p.phone.includes(q)
    );
  }, [patients, searchQuery]);

  // Check if selected patient has an appointment today
  const todayStr = '2026-09-29'; // Dynamic reference date
  const patientTodayAppointment = useMemo(() => {
    if (!selectedPatient) return null;
    return (
      appointments.find(
        (a) =>
          a.patientId === selectedPatient.id &&
          a.startsAt.startsWith(todayStr) &&
          a.status !== 'completed' &&
          a.status !== 'cancelled'
      ) || null
    );
  }, [selectedPatient, appointments]);

  // When selecting a patient, preselect their referent doctor
  const handleSelectFoundPatient = (p: Patient) => {
    setSelectedPatient(p);
    setIsCreatingNew(false);
    setSelectedDoctorId(p.primaryDoctorId || doctors[0]?.id || '');
  };

  // Submit check-in for existing patient with or without appointment
  const handleConfirmArrival = () => {
    if (!selectedPatient) return;

    const targetDoc =
      doctors.find((d) => d.id === (patientTodayAppointment?.practitionerId || selectedDoctorId)) ||
      doctors[0];

    const targetRoom = patientTodayAppointment?.roomCode || roomCode;
    const isWalkIn = !patientTodayAppointment;
    const reason = patientTodayAppointment ? patientTodayAppointment.reason : walkInReason;

    onCheckInPatient({
      patient: selectedPatient,
      appointmentId: patientTodayAppointment?.id,
      targetDoctorId: targetDoc.id,
      targetDoctorName: targetDoc.displayName,
      roomCode: targetRoom,
      reason,
      isWalkIn,
      priority: isWalkIn ? walkInPriority : 0,
    });

    const ticketNum = `T-${Math.floor(100 + Math.random() * 900)}`;
    setConfirmedArrival({
      patientName: `${selectedPatient.familyName.toUpperCase()} ${selectedPatient.givenName}`,
      ticketNumber: ticketNum,
      doctorName: targetDoc.displayName,
      room: targetRoom,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  // Submit creation and check-in for new patient
  const handleCreateAndCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim() || !newGivenName.trim()) return;

    const targetDoc = doctors.find((d) => d.id === newDoctorId) || doctors[0];

    const newPat: Patient = {
      id: `pat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      medicalRecordNumber: `MRN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      familyName: newFamilyName.trim(),
      givenName: newGivenName.trim(),
      birthDate: newBirthDate,
      gender: newGender,
      phone: newPhone || '06 00 00 00 00',
      email: `${newGivenName.toLowerCase()}.${newFamilyName.toLowerCase()}@email.fr`,
      address: {
        street: '1 rue de la Paix',
        city: 'Lyon',
        postalCode: '69001',
      },
      bloodGroup: 'Non renseigné',
      emergencyContact: {
        name: 'Personne à prévenir',
        relationship: 'Famille',
        phone: newPhone || '06 00 00 00 00',
      },
      insurance: {
        provider: 'CPAM Régime Général',
        policyNumber: `POL-${Date.now().toString().slice(-6)}`,
      },
      allergies: [],
      problems: [],
      vitalsHistory: [],
      medicalHistory: [],
      surgicalHistory: [],
      riskFactors: [],
      status: 'active',
      primaryDoctorId: targetDoc.id,
      primaryDoctorName: targetDoc.displayName,
      lastVisitDate: todayStr,
      tags: ['Nouveau Patient', 'Admission Accueil'],
    };

    onAddNewPatientAndCheckIn(newPat, {
      targetDoctorId: targetDoc.id,
      targetDoctorName: targetDoc.displayName,
      roomCode: 'Box 1',
      reason: newReason,
      priority: 0,
    });

    const ticketNum = `T-${Math.floor(100 + Math.random() * 900)}`;
    setConfirmedArrival({
      patientName: `${newPat.familyName.toUpperCase()} ${newPat.givenName}`,
      ticketNumber: ticketNum,
      doctorName: targetDoc.displayName,
      room: 'Box 1',
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const handleResetModal = () => {
    setSelectedPatient(null);
    setSearchQuery('');
    setIsCreatingNew(false);
    setConfirmedArrival(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md transition-all">
      <div className="w-full max-w-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white shadow-md shadow-blue-500/20">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Guichet Accueil & Admission Patient
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Temps Réel
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Orientation vers la salle d'attente & notification immédiate au médecin traitant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* STEP 3: Confirmed Arrival State with Ticket */}
        {confirmedArrival ? (
          <div className="mt-6 text-center space-y-5 py-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-3 py-1 text-xs font-bold mb-2">
                <Bell className="h-3.5 w-3.5 animate-bounce" />
                Médecin notifié en direct
              </span>
              <h4 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Patient orienté en Salle d'Attente !
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                La fiche a été transmise au poste de consultation du {confirmedArrival.doctorName}.
              </p>
            </div>

            {/* Ticket Card */}
            <div className="mx-auto max-w-sm border-2 border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-5 text-center">
              <div className="flex items-center justify-between text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                <span>Clinique Saint-Luc</span>
                <span>{confirmedArrival.time}</span>
              </div>
              <div className="my-3 font-mono text-4xl font-extrabold text-blue-900 dark:text-blue-100 tracking-wider">
                {confirmedArrival.ticketNumber}
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {confirmedArrival.patientName}
              </div>
              <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                Praticien : {confirmedArrival.doctorName} · {confirmedArrival.room}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                onClick={handleResetModal}
                className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all cursor-pointer"
              >
                Accueillir un autre patient
              </button>
              <button
                onClick={onClose}
                className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Fermer le guichet
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* Search Input for reception desk */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>1. Identification du Patient à l'arrivée</span>
                <span className="text-[11px] font-normal text-slate-500">
                  Ancien dossier ou création express
                </span>
              </label>
              <div className="mt-1.5 relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Tapez le nom, prénom, IPP (MRN-...), ou téléphone..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedPatient) setSelectedPatient(null);
                  }}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 pl-10 pr-24 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 focus:outline-hidden transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedPatient(null);
                    }}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    Effacer
                  </button>
                )}
              </div>

              {/* Live search results dropdown */}
              {searchQuery.trim() && !selectedPatient && !isCreatingNew && (
                <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 p-2 shadow-lg space-y-1">
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">
                      <span>Aucun dossier existant trouvé pour « {searchQuery} ».</span>
                      <button
                        onClick={() => {
                          setIsCreatingNew(true);
                          setNewFamilyName(searchQuery);
                        }}
                        className="mt-2 block mx-auto text-blue-600 dark:text-blue-400 font-bold hover:underline"
                      >
                        + Enregistrer comme Nouveau Patient
                      </button>
                    </div>
                  ) : (
                    searchResults.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectFoundPatient(p)}
                        className="flex items-center justify-between p-2.5 hover:bg-blue-50/80 dark:hover:bg-blue-950/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center bg-blue-100 dark:bg-blue-900/60 font-bold text-xs text-blue-800 dark:text-blue-200">
                            {p.familyName[0]}{p.givenName[0]}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                              {p.familyName.toUpperCase()} {p.givenName}
                            </span>
                            <span className="ml-2 font-mono text-[10px] text-slate-500">
                              {p.medicalRecordNumber}
                            </span>
                            <div className="text-[10px] text-slate-500">
                              Né(e) le {new Date(p.birthDate).toLocaleDateString('fr-FR')} · {p.phone}
                            </div>
                          </div>
                        </div>

                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          Sélectionner &rarr;
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* CASE 1: Patient Found (Ancien Patient) */}
            {selectedPatient && !isCreatingNew && (
              <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center bg-blue-600 text-white font-bold text-base shadow-sm">
                      {selectedPatient.familyName[0]}{selectedPatient.givenName[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                          {selectedPatient.familyName.toUpperCase()} {selectedPatient.givenName}
                        </span>
                        <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                          Dossier Connu
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{selectedPatient.medicalRecordNumber}</span>
                        <span>·</span>
                        <span>{selectedPatient.gender === 'F' ? 'Femme' : 'Homme'}</span>
                        <span>·</span>
                        <span>{selectedPatient.phone}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    Changer
                  </button>
                </div>

                {/* Branch A: Patient has appointment today */}
                {patientTodayAppointment ? (
                  <div className="border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/40 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <Calendar className="h-4 w-4" />
                        <span>Rendez-vous planifié aujourd'hui détecté</span>
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {new Date(patientTodayAppointment.startsAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      Praticien prévu :{' '}
                      <span className="font-bold">{patientTodayAppointment.practitionerName}</span> · Salle{' '}
                      <span className="font-bold">{patientTodayAppointment.roomCode}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Motif : {patientTodayAppointment.reason}
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleConfirmArrival}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 text-xs shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <UserCheck className="h-4 w-4" />
                        <span>Valider l'arrivée & Notifier {patientTodayAppointment.practitionerName}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Branch B: Patient has no appointment today (Sans RDV) */
                  <div className="border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/40 p-3.5 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <Clock className="h-4 w-4" />
                      <span>Aucun rendez-vous planifié aujourd'hui (Consultation Sans RDV)</span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Le patient se présente spontanément. Choisissez le médecin vers lequel l'orienter :
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Médecin traitant / récepteur *
                        </label>
                        <select
                          value={selectedDoctorId}
                          onChange={(e) => setSelectedDoctorId(e.target.value)}
                          className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                        >
                          {doctors.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.displayName} ({doc.department})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Salle d'Attente / Box
                        </label>
                        <select
                          value={roomCode}
                          onChange={(e) => setRoomCode(e.target.value)}
                          className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                        >
                          <option value="Box 1">Box 1 (Dr. Martin)</option>
                          <option value="Box 2">Box 2 (Dr. Lefèvre)</option>
                          <option value="Box 3">Box 3 (Dr. Benali)</option>
                          <option value="Salle Soins">Salle de soins IDE</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Motif d'admission
                      </label>
                      <input
                        type="text"
                        value={walkInReason}
                        onChange={(e) => setWalkInReason(e.target.value)}
                        placeholder="Ex: Demande de consultation aiguë, renouvellement, avis..."
                        className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={handleConfirmArrival}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 text-xs shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <UserCheck className="h-4 w-4" />
                        <span>Orienter vers la salle d'attente & Notifier le médecin</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CASE 2: Nouveau Patient (Creation Express) */}
            {isCreatingNew && (
              <form
                onSubmit={handleCreateAndCheckIn}
                className="border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 p-4 space-y-3.5 text-xs"
              >
                <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/40 pb-2">
                  <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-100 text-xs">
                    <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span>Création Express d'un Nouveau Dossier Patient</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Annuler
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Nom *</label>
                    <input
                      type="text"
                      required
                      value={newFamilyName}
                      onChange={(e) => setNewFamilyName(e.target.value)}
                      placeholder="Ex: Dupont"
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Prénom *</label>
                    <input
                      type="text"
                      required
                      value={newGivenName}
                      onChange={(e) => setNewGivenName(e.target.value)}
                      placeholder="Ex: Thomas"
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Date naissance</label>
                    <input
                      type="date"
                      required
                      value={newBirthDate}
                      onChange={(e) => setNewBirthDate(e.target.value)}
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Genre</label>
                    <select
                      value={newGender}
                      onChange={(e) => setNewGender(e.target.value as 'M' | 'F' | 'O')}
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs font-semibold"
                    >
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                      <option value="O">Autre</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Téléphone</label>
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="06 12 34 56 78"
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Médecin traitant attribué *
                    </label>
                    <select
                      value={newDoctorId}
                      onChange={(e) => setNewDoctorId(e.target.value)}
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs font-semibold"
                    >
                      {doctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.displayName} ({doc.department})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Motif d'arrivée
                    </label>
                    <input
                      type="text"
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      placeholder="Ex: Première consultation"
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 text-xs shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Enregistrer le Dossier & Orienter en Salle d'Attente</span>
                </button>
              </form>
            )}

            {/* Quick action button to trigger New Patient if not typing */}
            {!selectedPatient && !isCreatingNew && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => setIsCreatingNew(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Le patient vient pour la première fois ? Créer un nouveau dossier</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

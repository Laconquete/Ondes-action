import React, { useState, useMemo } from 'react';
import {
  Search,
  UserPlus,
  AlertTriangle,
  Calendar,
  Phone,
  Mail,
  Shield,
  FileText,
  Activity,
  ArrowRight,
  User,
  Filter,
  Stethoscope,
  Heart,
  Clock,
  CheckCircle2,
  X,
  Play,
  Pill,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserCheck,
  Building2,
  ExternalLink,
  Maximize2,
  FileDown,
} from 'lucide-react';
import { Patient, AppUser } from '../types/clinical';
import { PatientVitalsTrends } from './PatientVitalsTrends';
import { exportPatientDossierPdf } from '../services/pdfExportService';
import { analyzePatientVitals } from '../services/clinicalAlertsEngine';

interface PatientListAndDetailProps {
  patients: Patient[];
  onSelectPatient: (patientId: string) => void;
  onOpenConsultation: (patientId: string) => void;
  onAddPatient: (patient: Patient) => void;
  canViewClinical: boolean;
  currentUser?: AppUser;
  allDoctors?: AppUser[];
  onUpdatePatientDoctor?: (patientId: string, doctorId: string, doctorName: string) => void;
  onOpenScheduleForPatient?: (patientId: string) => void;
  onOpenReceptionCheckIn?: () => void;
}

type SortColumn = 'name' | 'ipp' | 'lastVisit' | 'age' | 'doctor';
type SortDirection = 'asc' | 'desc';

export const PatientListAndDetail: React.FC<PatientListAndDetailProps> = ({
  patients,
  onSelectPatient,
  onOpenConsultation,
  onAddPatient,
  canViewClinical,
  currentUser,
  allDoctors = [],
  onUpdatePatientDoctor,
  onOpenScheduleForPatient,
  onOpenReceptionCheckIn,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || '');
  const [filterScope, setFilterScope] = useState<'all' | 'my' | 'risk' | 'recent'>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);

  // Sorting state for Modern Data Table
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // New patient form fields
  const [familyName, setFamilyName] = useState('');
  const [givenName, setGivenName] = useState('');
  const [birthDate, setBirthDate] = useState('1990-01-01');
  const [gender, setGender] = useState<'M' | 'F' | 'O'>('M');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('CPAM Régime Général');
  const [assignedDoctorId, setAssignedDoctorId] = useState<string>(
    currentUser?.id || allDoctors[0]?.id || ''
  );
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Handle column sort toggle
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Row click interaction: calls handleSelectPatient as requested
  const handleSelectPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    onSelectPatient(patientId);
  };

  // Filter & sort patients
  const processedPatients = useMemo(() => {
    // 1. Filtering
    const filtered = patients.filter((p) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.familyName.toLowerCase().includes(q) ||
        p.givenName.toLowerCase().includes(q) ||
        p.medicalRecordNumber.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.problems.some((prob) => prob.display.toLowerCase().includes(q)) ||
        Boolean(p.tags && p.tags.some((t) => t.toLowerCase().includes(q)));

      const matchDoctor =
        doctorFilter === 'all' || p.primaryDoctorId === doctorFilter;

      let matchScope = true;
      if (filterScope === 'my') {
        matchScope = p.primaryDoctorId === currentUser?.id || !p.primaryDoctorId;
      } else if (filterScope === 'risk') {
        matchScope =
          p.allergies.some((a) => a.severity === 'critical') ||
          p.problems.length >= 2 ||
          Boolean(p.tags?.includes('ALD'));
      } else if (filterScope === 'recent') {
        matchScope = Boolean(p.lastVisitDate);
      }

      return matchSearch && matchDoctor && matchScope;
    });

    // 2. Sorting
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'name': {
          const nameA = `${a.familyName} ${a.givenName}`.toLowerCase();
          const nameB = `${b.familyName} ${b.givenName}`.toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case 'ipp': {
          comparison = a.medicalRecordNumber.localeCompare(b.medicalRecordNumber);
          break;
        }
        case 'lastVisit': {
          const dateA = a.lastVisitDate ? new Date(a.lastVisitDate).getTime() : 0;
          const dateB = b.lastVisitDate ? new Date(b.lastVisitDate).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
        case 'age': {
          const dateA = new Date(a.birthDate).getTime();
          const dateB = new Date(b.birthDate).getTime();
          comparison = dateB - dateA; // older = smaller timestamp
          break;
        }
        case 'doctor': {
          const docA = (a.primaryDoctorName || '').toLowerCase();
          const docB = (b.primaryDoctorName || '').toLowerCase();
          comparison = docA.localeCompare(docB);
          break;
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [
    patients,
    searchTerm,
    doctorFilter,
    filterScope,
    currentUser?.id,
    sortColumn,
    sortDirection,
  ]);

  const activePatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Anti-doublon check
  const handleFamilyNameChange = (val: string) => {
    setFamilyName(val);
    checkDuplicate(val, birthDate);
  };

  const handleBirthDateChange = (val: string) => {
    setBirthDate(val);
    checkDuplicate(familyName, val);
  };

  const checkDuplicate = (name: string, bDate: string) => {
    if (!name.trim() || !bDate) {
      setDuplicateWarning(null);
      return;
    }

    const matched = patients.find(
      (p) =>
        p.familyName.toLowerCase() === name.trim().toLowerCase() &&
        p.birthDate === bDate
    );

    if (matched) {
      setDuplicateWarning(
        `Attention : un dossier actif existe déjà pour "${matched.familyName.toUpperCase()} ${matched.givenName}" né(e) le ${new Date(matched.birthDate).toLocaleDateString('fr-FR')} (IPP : ${matched.medicalRecordNumber}). Fusion de dossier requise plutôt que création de doublon.`
      );
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName.trim() || !givenName.trim()) return;

    const assignedDoc = allDoctors.find((d) => d.id === assignedDoctorId);

    const newPat: Patient = {
      id: `pat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      medicalRecordNumber: `MRN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      familyName: familyName.trim(),
      givenName: givenName.trim(),
      birthDate,
      gender,
      phone: phone || '06 00 00 00 00',
      email: email || `${givenName.toLowerCase()}.${familyName.toLowerCase()}@email.fr`,
      address: {
        street: '1 rue de la Paix',
        city: 'Lyon',
        postalCode: '69001',
      },
      bloodGroup: 'Non renseigné',
      emergencyContact: {
        name: 'Personne à prévenir',
        relationship: 'Famille',
        phone: phone || '06 00 00 00 00',
      },
      insurance: {
        provider: insuranceProvider,
        policyNumber: `POL-${Date.now().toString().slice(-6)}`,
      },
      allergies: [],
      problems: [],
      vitalsHistory: [],
      medicalHistory: [],
      surgicalHistory: [],
      riskFactors: [],
      status: 'active',
      primaryDoctorId: assignedDoc?.id || currentUser?.id,
      primaryDoctorName: assignedDoc?.displayName || currentUser?.displayName,
      lastVisitDate: new Date().toISOString().split('T')[0],
      tags: ['Nouveau Patient'],
    };

    onAddPatient(newPat);
    handleSelectPatient(newPat.id);
    setIsNewPatientOpen(false);
    setFamilyName('');
    setGivenName('');
    setDuplicateWarning(null);
  };

  // Helper for sort indicator icons
  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
    );
  };

  return (
    <div className="space-y-5">
      {/* Premium Header & Reception Quick Desk */}
      <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-clinical transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Répertoire & Dossiers Patients CRM
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 text-xs font-semibold">
                  {patients.length} dossiers
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tableau de données interactif avec tri multi-colonnes, sélection de ligne et orientation accueil
              </p>
            </div>
          </div>

          {/* Action buttons including Reception Admission */}
          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenReceptionCheckIn && (
              <button
                onClick={onOpenReceptionCheckIn}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/15 transition-all cursor-pointer hover:scale-102"
              >
                <UserCheck className="h-4 w-4" />
                <span>Accueil & Arrivée Patient</span>
              </button>
            )}

            <button
              onClick={() => setIsNewPatientOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/15 transition-all cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Nouveau Patient</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Filter Scope Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-1">
            <button
              onClick={() => setFilterScope('all')}
              className={` px-3 py-1.5 text-xs font-semibold transition-all ${
                filterScope === 'all'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Tous ({patients.length})
            </button>
            <button
              onClick={() => setFilterScope('my')}
              className={` px-3 py-1.5 text-xs font-semibold transition-all ${
                filterScope === 'my'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Mes Patients
            </button>
            <button
              onClick={() => setFilterScope('risk')}
              className={` px-3 py-1.5 text-xs font-semibold transition-all ${
                filterScope === 'risk'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Risques & ALD
            </button>
            <button
              onClick={() => setFilterScope('recent')}
              className={` px-3 py-1.5 text-xs font-semibold transition-all ${
                filterScope === 'recent'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Consultés Récemment
            </button>
          </div>

          {/* Doctor Selector */}
          {allDoctors.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Stethoscope className="h-3.5 w-3.5" />
                <span>Médecin :</span>
              </label>
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden"
              >
                <option value="all">Tous les confrères</option>
                {allDoctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.displayName} ({doc.department})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Instant Search Bar */}
        <div className="mt-3 relative">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Recherche instantanée par nom, prénom, IPP (MRN-...), téléphone, pathologie ou tag..."
            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 focus:outline-hidden transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Main Grid: Modern Data Table (Left) & Comprehensive Medical Drawer (Right) */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left: Modern Sortable Data Table */}
        <div className="col-span-12 xl:col-span-7">
          <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-clinical overflow-hidden transition-colors">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                Affichage de <span className="font-bold text-slate-800 dark:text-slate-200">{processedPatients.length}</span> patient(s) · Cliquez sur une ligne pour ouvrir sa fiche
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                Tri actuel : {sortColumn} ({sortDirection === 'asc' ? 'A &rarr; Z' : 'Z &rarr; A'})
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-xs border-collapse">
                {/* Modern Sortable Column Headers */}
                <thead className="bg-slate-50/80 dark:bg-slate-850 text-slate-600 dark:text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200/80 dark:border-slate-800 select-none">
                  <tr>
                    {/* Sortable: Name */}
                    <th
                      onClick={() => handleSort('name')}
                      className="p-3.5 cursor-pointer group hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Patient</span>
                        {renderSortIcon('name')}
                      </div>
                    </th>

                    {/* Sortable: IPP */}
                    <th
                      onClick={() => handleSort('ipp')}
                      className="p-3.5 cursor-pointer group hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors font-mono"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>IPP (MRN)</span>
                        {renderSortIcon('ipp')}
                      </div>
                    </th>

                    {/* Sortable: Age */}
                    <th
                      onClick={() => handleSort('age')}
                      className="p-3.5 cursor-pointer group hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Âge / Sexe</span>
                        {renderSortIcon('age')}
                      </div>
                    </th>

                    {/* Sortable: Last Visit */}
                    <th
                      onClick={() => handleSort('lastVisit')}
                      className="p-3.5 cursor-pointer group hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Dernière Visite</span>
                        {renderSortIcon('lastVisit')}
                      </div>
                    </th>

                    {/* Sortable: Doctor */}
                    <th
                      onClick={() => handleSort('doctor')}
                      className="p-3.5 cursor-pointer group hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Médecin</span>
                        {renderSortIcon('doctor')}
                      </div>
                    </th>

                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>

                {/* Table Body with Row Click Interaction calling handleSelectPatient */}
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-sans">
                  {processedPatients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">
                        Aucun dossier patient ne correspond à votre recherche ou à vos filtres.
                      </td>
                    </tr>
                  ) : (
                    processedPatients.map((pat) => {
                      const isSelected = pat.id === activePatient?.id;
                      const patAge = Math.floor(
                        (new Date().getTime() - new Date(pat.birthDate).getTime()) /
                          (365.25 * 24 * 60 * 60 * 1000)
                      );
                      const hasCriticalAllergy = pat.allergies.some((a) => a.severity === 'critical');
                      const latestVitals = pat.vitalsHistory[pat.vitalsHistory.length - 1];

                      return (
                        <tr
                          key={pat.id}
                          onClick={() => handleSelectPatient(pat.id)}
                          className={`cursor-pointer transition-all duration-150 ${
                            isSelected
                              ? 'bg-blue-50/90 dark:bg-blue-950/40 font-semibold ring-1 ring-inset ring-blue-500/20'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-850/60'
                          }`}
                        >
                          {/* Patient Name */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center text-xs font-bold transition-colors ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {pat.familyName[0]}{pat.givenName[0]}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                  {pat.familyName.toUpperCase()} {pat.givenName}
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  {hasCriticalAllergy && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                      <AlertTriangle className="h-2.5 w-2.5" />
                                      Allergie critique
                                    </span>
                                  )}
                                  {(() => {
                                    const patAlerts = analyzePatientVitals(pat);
                                    if (patAlerts.length === 0) return null;
                                    return patAlerts.map((alt) => (
                                      <span
                                        key={alt.id}
                                        title={`${alt.title} : ${alt.recommendation}`}
                                        className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/80 px-1.5 py-0.2 rounded border border-rose-300 dark:border-rose-800"
                                      >
                                        <AlertTriangle className="h-2.5 w-2.5 text-rose-600" />
                                        {alt.badgeLabel}
                                      </span>
                                    ));
                                  })()}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* IPP */}
                          <td className="p-3.5 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                            {pat.medicalRecordNumber}
                          </td>

                          {/* Age & Gender */}
                          <td className="p-3.5 text-slate-700 dark:text-slate-300">
                            <span>{patAge} ans</span>
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({pat.gender === 'F' ? 'F' : 'M'})
                            </span>
                          </td>

                          {/* Last Visit */}
                          <td className="p-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                            {pat.lastVisitDate ? (
                              <span>{new Date(pat.lastVisitDate).toLocaleDateString('fr-FR')}</span>
                            ) : (
                              <span className="text-slate-400 italic">Jamais</span>
                            )}
                          </td>

                          {/* Assigned Doctor + Reservation Status */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              {pat.primaryDoctorName ? (
                                <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-semibold">
                                  {pat.primaryDoctorName.replace('Dr. ', '')}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Non assigné</span>
                              )}
                              {/* Badge "Réservé" avec cadenas au survol */}
                              {pat.isReserved && (
                                <span
                                  className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-bold cursor-help"
                                  title={`🔒 Réservé par ${pat.reservedByName || 'un médecin'}${pat.reservedReason ? '\nMotif : ' + pat.reservedReason : ''}`}
                                >
                                  🔒
                                </span>
                              )}
                              {/* Badge "Transfert en attente" */}
                              {pat.pendingTransferToId && (
                                <span
                                  className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-bold animate-pulse"
                                  title={`Transfert en attente vers ${pat.pendingTransferToName}`}
                                >
                                  →
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectPatient(pat.id);
                                  onOpenConsultation(pat.id);
                                }}
                                title="Lancer la consultation médicale"
                                className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2.5 py-1 text-xs font-bold transition-colors"
                              >
                                <Play className="h-3 w-3 fill-current" />
                                <span>Consulter</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Comprehensive Medical Record Preview & Actions */}
        <div className="col-span-12 xl:col-span-5 space-y-4">
          {activePatient ? (
            <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-clinical space-y-6 transition-colors">
              {/* Patient Identification Card */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-14 w-14 items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white font-extrabold text-lg shadow-md shadow-blue-500/20">
                    {activePatient.familyName[0]}{activePatient.givenName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {activePatient.familyName.toUpperCase()} {activePatient.givenName}
                      </h2>
                      <span className="rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 px-2 py-0.5 text-xs font-semibold">
                        {activePatient.gender === 'F' ? 'Femme' : 'Homme'} · {Math.floor(
                          (new Date().getTime() - new Date(activePatient.birthDate).getTime()) /
                            (365.25 * 24 * 60 * 60 * 1000)
                        )} ans
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        IPP: {activePatient.medicalRecordNumber}
                      </span>
                      <span>·</span>
                      <span>Né(e) le {new Date(activePatient.birthDate).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (currentUser) {
                        exportPatientDossierPdf({
                          patient: activePatient,
                          currentUser,
                        });
                      }
                    }}
                    className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 px-3 py-2 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Exporter le dossier patient en PDF certifié HDS"
                  >
                    <FileDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">Export PDF</span>
                  </button>

                  <button
                    onClick={() => onOpenConsultation(activePatient.id)}
                    className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Ouvrir Dossier</span>
                  </button>
                </div>
              </div>

              {/* Referent Doctor Assignment Widget */}
              <div className="border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                      Médecin Référent Attribué
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {activePatient.primaryDoctorName || 'Non assigné'}
                    </span>
                  </div>
                </div>

                {allDoctors.length > 0 && onUpdatePatientDoctor && (
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-medium text-slate-500">Changer :</label>
                    <select
                      value={activePatient.primaryDoctorId || ''}
                      onChange={(e) => {
                        const targetDoc = allDoctors.find((d) => d.id === e.target.value);
                        if (targetDoc) {
                          onUpdatePatientDoctor(activePatient.id, targetDoc.id, targetDoc.displayName);
                        }
                      }}
                      className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden"
                    >
                      {allDoctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Critical Allergies Box if present */}
              {canViewClinical && activePatient.allergies.length > 0 && (
                <div className="border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <span>Allergies Médicamenteuses Critiques ({activePatient.allergies.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {activePatient.allergies.map((all) => (
                      <div
                        key={all.id}
                        className="bg-white/80 dark:bg-slate-900/80 p-2.5 text-xs border border-rose-100 dark:border-rose-900/40 flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {all.substanceDisplay}
                        </span>
                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded">
                          {all.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Problems CIM-10 */}
              {canViewClinical && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                    Pathologies Actives (CIM-10)
                  </h3>
                  <div className="space-y-2">
                    {activePatient.problems.map((pr) => (
                      <div
                        key={pr.id}
                        className="border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/40 p-3 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">
                            {pr.display}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Diagnostiqué le {new Date(pr.onsetDate).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5">
                          {pr.code}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Vitals */}
              {canViewClinical && activePatient.vitalsHistory.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Dernières Constantes Vitales
                    </h3>
                  </div>

                  {/* Real-time Clinical Alerts Banner for Active Patient */}
                  {(() => {
                    const activeAlerts = analyzePatientVitals(activePatient);
                    if (activeAlerts.length === 0) return null;
                    return (
                      <div className="mb-3 p-3 border border-rose-300 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/40 text-xs space-y-1.5 shadow-2xs">
                        <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-200">
                          <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
                          <span>Alerte Clinique Constantes ({activeAlerts.length})</span>
                        </div>
                        {activeAlerts.map((alt) => (
                          <div key={alt.id} className="text-[11px] text-rose-950 dark:text-rose-200 leading-snug">
                            <span className="font-extrabold">• {alt.badgeLabel} ({alt.valueDisplay}) :</span> {alt.recommendation}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    {(() => {
                      const vit = activePatient.vitalsHistory[activePatient.vitalsHistory.length - 1];
                      return (
                        <>
                          <div className="border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-850/50">
                            <span className="text-[10px] text-slate-500 uppercase">Tension</span>
                            <p className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                              {vit.systolic}/{vit.diastolic}
                            </p>
                            <span className="text-[10px] text-slate-400">mmHg</span>
                          </div>

                          <div className="border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-850/50">
                            <span className="text-[10px] text-slate-500 uppercase">Pouls</span>
                            <p className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                              {vit.pulseBpm}
                            </p>
                            <span className="text-[10px] text-slate-400">bpm</span>
                          </div>

                          <div className="border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-850/50">
                            <span className="text-[10px] text-slate-500 uppercase">Poids</span>
                            <p className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                              {vit.weightKg}
                            </p>
                            <span className="text-[10px] text-slate-400">kg</span>
                          </div>

                          <div className="border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-850/50">
                            <span className="text-[10px] text-slate-500 uppercase">SpO2</span>
                            <p className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                              {vit.oxygenSaturation}%
                            </p>
                            <span className="text-[10px] text-slate-400">Ambiant</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Recharts Data Visualization: Blood Pressure & Weight Evolution over last 6 months */}
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center bg-blue-600 text-white font-bold shadow-xs">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>Évolution des Signes Vitaux (6 derniers mois)</span>
                            <span className="rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] px-1.5 py-0.2 font-mono font-bold">
                              Recharts
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            Courbe de Tension Artérielle (mmHg) & Poids (kg) avec contraste clinique renforcé
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsVitalsModalOpen(true)}
                        className="inline-flex items-center gap-1 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
                        title="Agrandir en plein écran pour une analyse approfondie"
                      >
                        <Maximize2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="hidden sm:inline">Agrandir</span>
                      </button>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
                      <PatientVitalsTrends
                        patient={activePatient}
                        compact={true}
                        defaultTimeRange="6months"
                        defaultMetricView="bp_weight"
                        hideHeaderCard={false}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Administrative info */}
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Téléphone & Email</span>
                  <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {activePatient.phone}
                  </p>
                  <p className="text-slate-500 truncate">{activePatient.email}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Assurance Maladie</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {activePatient.insurance.provider}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {activePatient.insurance.policyNumber}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-xs text-slate-500">
              Sélectionnez un patient dans le tableau de gauche pour consulter sa fiche.
            </div>
          )}
        </div>
      </div>

      {/* New Patient Modal */}
      {isNewPatientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                  <UserPlus className="h-5 w-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Nouveau Dossier Patient
                </h3>
              </div>
              <button
                onClick={() => setIsNewPatientOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="mt-4 space-y-4 text-xs">
              {duplicateWarning && (
                <div className="border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 p-3 text-amber-900 dark:text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>{duplicateWarning}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Nom *</label>
                  <input
                    type="text"
                    required
                    value={familyName}
                    onChange={(e) => handleFamilyNameChange(e.target.value)}
                    placeholder="Ex: Martin"
                    className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={givenName}
                    onChange={(e) => setGivenName(e.target.value)}
                    placeholder="Ex: Julien"
                    className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Date de naissance *</label>
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => handleBirthDateChange(e.target.value)}
                    className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Genre *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'M' | 'F' | 'O')}
                    className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                  >
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                    <option value="O">Autre</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Téléphone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="patient@email.fr"
                    className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {allDoctors.length > 0 && (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Médecin Traitant Référent
                  </label>
                  <select
                    value={assignedDoctorId}
                    onChange={(e) => setAssignedDoctorId(e.target.value)}
                    className="mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                  >
                    {allDoctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.displayName} ({doc.department})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewPatientOpen(false)}
                  className="border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs"
                >
                  Enregistrer le Dossier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Vitals Trends Modal */}
      {isVitalsModalOpen && activePatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md transition-all">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Analyse Approfondie des Constantes</span>
                    <span className="font-mono text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 border border-blue-200 dark:border-blue-800">
                      {activePatient.familyName.toUpperCase()} {activePatient.givenName}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    IPP : {activePatient.medicalRecordNumber} · Visualisation multi-paramétrique Recharts avec contraste clinique renforcé (Tension & Poids sur 6 mois)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsVitalsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <PatientVitalsTrends
              patient={activePatient}
              compact={false}
              defaultTimeRange="6months"
              defaultMetricView="bp_weight"
              hideHeaderCard={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

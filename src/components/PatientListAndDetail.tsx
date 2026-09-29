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
} from 'lucide-react';
import { Patient, AppUser } from '../types/clinical';

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
}

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
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || '');
  const [filterScope, setFilterScope] = useState<'all' | 'my' | 'risk' | 'recent'>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);

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

  // Filter patients
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      // Search query
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.familyName.toLowerCase().includes(q) ||
        p.givenName.toLowerCase().includes(q) ||
        p.medicalRecordNumber.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.problems.some((prob) => prob.display.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)));

      // Doctor filter
      const matchDoctor =
        doctorFilter === 'all' || p.primaryDoctorId === doctorFilter;

      // Filter scope
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
  }, [patients, searchTerm, doctorFilter, filterScope, currentUser?.id]);

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
    setSelectedPatientId(newPat.id);
    setIsNewPatientOpen(false);
    setFamilyName('');
    setGivenName('');
    setDuplicateWarning(null);
  };

  return (
    <div className="space-y-4">
      {/* WuKong CRM inspired Patient Toolbar with Tabs & Search */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* CRM Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-1">
            <button
              onClick={() => setFilterScope('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filterScope === 'all'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Tous les Patients ({patients.length})
            </button>
            <button
              onClick={() => setFilterScope('my')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filterScope === 'my'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Mes Patients
            </button>
            <button
              onClick={() => setFilterScope('risk')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filterScope === 'risk'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Risques & ALD
            </button>
            <button
              onClick={() => setFilterScope('recent')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filterScope === 'recent'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Récents
            </button>
          </div>

          {/* Doctor filter dropdown & New Patient button */}
          <div className="flex flex-wrap items-center gap-2.5">
            {allDoctors.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Stethoscope className="h-3.5 w-3.5" />
                  <span>Médecin :</span>
                </label>
                <select
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value="all">Tous les confrères</option>
                  {allDoctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setIsNewPatientOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Nouveau Patient</span>
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom, prénom, IPP (MRN-...), téléphone, pathologie ou mot-clé..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 focus:outline-hidden transition-colors"
          />
        </div>
      </div>

      {/* Main 2-Column Split: Dynamic Clickable Table & Slide-over / Detail Drawer */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left Column (5 cols on lg): Clickable Patient List */}
        <div className="col-span-12 lg:col-span-5 space-y-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-clinical transition-colors">
            <div className="flex items-center justify-between px-2 py-1 mb-2 text-xs text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800 pb-2">
              <span>{filteredPatients.length} patient(s) affiché(s)</span>
              <span>Cliquez pour afficher</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[620px] overflow-y-auto pr-1">
              {filteredPatients.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                  Aucun patient trouvé. Modifiez vos filtres ou effectuez une recherche.
                </div>
              ) : (
                filteredPatients.map((pat) => {
                  const isSelected = pat.id === activePatient?.id;
                  const patAge = Math.floor(
                    (new Date().getTime() - new Date(pat.birthDate).getTime()) /
                      (365.25 * 24 * 60 * 60 * 1000)
                  );
                  const latestVitals = pat.vitalsHistory[pat.vitalsHistory.length - 1];
                  const hasCriticalAllergy = pat.allergies.some((a) => a.severity === 'critical');

                  return (
                    <div
                      key={pat.id}
                      onClick={() => {
                        setSelectedPatientId(pat.id);
                        onSelectPatient(pat.id);
                      }}
                      className={`p-3 rounded-xl cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'bg-blue-50/90 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 shadow-2xs ring-1 ring-blue-500/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {pat.familyName[0]}{pat.givenName[0]}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {pat.familyName.toUpperCase()} {pat.givenName}
                            </span>
                            <span className="block font-mono text-[10px] text-slate-500 dark:text-slate-400 font-semibold tabular-nums">
                              {pat.medicalRecordNumber}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                            {patAge} ans
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            {pat.gender === 'F' ? 'Femme' : 'Homme'}
                          </span>
                        </div>
                      </div>

                      {/* Doctor Referent & Problems */}
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {pat.primaryDoctorName && (
                          <span className="rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/60 text-indigo-800 dark:text-indigo-300 px-1.5 py-0.5 text-[10px] font-semibold">
                            Dr. {pat.primaryDoctorName.replace('Dr. ', '')}
                          </span>
                        )}

                        {pat.problems.slice(0, 1).map((prob) => (
                          <span
                            key={prob.id}
                            className="rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 text-[10px]"
                          >
                            {prob.display}
                          </span>
                        ))}

                        {hasCriticalAllergy && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 px-1.5 py-0.5 text-[10px] font-bold">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Allergie
                          </span>
                        )}
                      </div>

                      {/* Latest Vitals footer */}
                      {latestVitals && (
                        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-mono tabular-nums">
                            {latestVitals.systolic}/{latestVitals.diastolic} mmHg
                          </span>
                          <span className="font-mono tabular-nums">
                            {latestVitals.pulseBpm} bpm
                          </span>
                          <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-0.5">
                            <span>Voir fiche</span>
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (7 cols on lg): Comprehensive Patient Detail & CRM Actions */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {activePatient ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-clinical space-y-6 transition-colors">
              {/* Header Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-lg shadow-md shadow-blue-500/20">
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
                      <span>·</span>
                      <span>Groupe: {activePatient.bloodGroup}</span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button: Lancer Consultation */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onOpenConsultation(activePatient.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Démarrer Consultation</span>
                  </button>

                  {onOpenScheduleForPatient && (
                    <button
                      onClick={() => onOpenScheduleForPatient(activePatient.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Prendre RDV</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Referent Doctor Assignment Widget */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                      Médecin Référent / Suivi Clinique
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Actuellement attribué à : {activePatient.primaryDoctorName || 'Non assigné'}
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
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden"
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

              {/* Critical Alerts / Allergies Section */}
              {canViewClinical && activePatient.allergies.length > 0 && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <span>Allergies Médicamenteuses Signalées ({activePatient.allergies.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {activePatient.allergies.map((all) => (
                      <div
                        key={all.id}
                        className="rounded-lg bg-white/80 dark:bg-slate-900/80 p-2 text-xs border border-rose-100 dark:border-rose-900/40 flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {all.substanceDisplay}
                        </span>
                        <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 uppercase">
                          {all.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clinical Problems (CIM-10) */}
              {canViewClinical && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                    Pathologies Actives (CIM-10)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activePatient.problems.map((pr) => (
                      <div
                        key={pr.id}
                        className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/40 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                          <span>{pr.display}</span>
                          <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1 py-0.5 rounded">
                            {pr.code}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          Diagnostiqué le {new Date(pr.onsetDate).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Vitals Strip */}
              {canViewClinical && activePatient.vitalsHistory.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                    Dernières Mesures Cliniques
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    {(() => {
                      const vit = activePatient.vitalsHistory[activePatient.vitalsHistory.length - 1];
                      return (
                        <>
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-850/50">
                            <span className="text-[10px] text-slate-500 uppercase">Tension Art.</span>
                            <p className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                              {vit.systolic}/{vit.diastolic}
                            </p>
                            <span className="text-[10px] text-slate-400">mmHg</span>
                          </div>

                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-850/50">
                            <span className="text-[10px] text-slate-500 uppercase">Pouls</span>
                            <p className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                              {vit.pulseBpm}
                            </p>
                            <span className="text-[10px] text-slate-400">bpm</span>
                          </div>

                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-850/50">
                            <span className="text-[10px] text-slate-500 uppercase">Poids</span>
                            <p className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                              {vit.weightKg}
                            </p>
                            <span className="text-[10px] text-slate-400">kg (IMC {vit.bmi})</span>
                          </div>

                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-850/50">
                            <span className="text-[10px] text-slate-500 uppercase">SpO2</span>
                            <p className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                              {vit.oxygenSaturation}%
                            </p>
                            <span className="text-[10px] text-slate-400">Air ambiant</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Administrative & Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Coordonnées</span>
                  <div className="space-y-1 text-slate-800 dark:text-slate-200">
                    <p className="flex items-center gap-1.5 font-mono">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{activePatient.phone}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span>{activePatient.email}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Couverture Médicale</span>
                  <p className="text-slate-800 dark:text-slate-200 font-medium">
                    {activePatient.insurance.provider}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    Police : {activePatient.insurance.policyNumber}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-xs text-slate-500 dark:text-slate-400">
              Sélectionnez un patient dans la liste pour voir sa fiche complète.
            </div>
          )}
        </div>
      </div>

      {/* New Patient Modal Form */}
      {isNewPatientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
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
                <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 p-3 text-amber-900 dark:text-amber-300 flex items-start gap-2">
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
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Genre *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'M' | 'F' | 'O')}
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="patient@email.fr"
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
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
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs"
                >
                  Enregistrer le Dossier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

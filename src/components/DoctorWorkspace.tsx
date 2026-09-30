import React, { useState } from 'react';
import {
  Activity,
  AlertOctagon,
  Calendar,
  CheckCircle2,
  FileEdit,
  History,
  Lock,
  Unlock,
  ArrowRightLeft,
  Pill,
  Plus,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  TrendingUp,
  BarChart3,
  Copy,
  Check,
  Phone,
  Shield,
  Clock,
  ArrowRight,
  ClipboardList,
  FileDown,
  Loader2,
} from 'lucide-react';
import {
  Patient,
  ClinicalNote,
  ClinicalAddendum,
  MedicationOrder,
  AppUser,
  FollowUpTask,
  VitalSignSet,
} from '../types/clinical';
import { PatientVitalsTrends } from './PatientVitalsTrends';
import { TransferPatientDialog } from './TransferPatientDialog';
import { exportPatientDossierPdf } from '../services/pdfExportService';
import { analyzePatientVitals } from '../services/clinicalAlertsEngine';
import { usePatientReservation } from '../hooks/usePatientReservation';

interface DoctorWorkspaceProps {
  patient: Patient;
  patientsList: Patient[];
  onSelectPatient: (patientId: string) => void;
  currentUser: AppUser;
  clinicalNote: ClinicalNote;
  addenda: ClinicalAddendum[];
  activeMedications: MedicationOrder[];
  followUps: FollowUpTask[];
  onSaveNoteDraft: (note: ClinicalNote) => void;
  onSignNote: (note: ClinicalNote) => void;
  onAddAddendum: (addendum: Omit<ClinicalAddendum, 'id' | 'authoredAt'>) => void;
  onOpenPrescriptionModal: () => void;
  onOpenSchedule: () => void;
  onOpenFollowUpModal: () => void;
  canEditClinical: boolean;
  canPrescribe: boolean;
  // Réservation / transfert de patient
  allDoctors?: AppUser[];
  onUpdatePatient?: (patientId: string, updates: Partial<Patient>) => void;
  onAudit?: (action: string, resourceType: string, details: {
    resourceId?: string;
    patientId?: string;
    patientName?: string;
    outcome?: 'allowed' | 'denied' | 'challenged';
    reasonText?: string;
  }) => void;
}

export const DoctorWorkspace: React.FC<DoctorWorkspaceProps> = ({
  patient,
  patientsList,
  onSelectPatient,
  currentUser,
  clinicalNote,
  addenda,
  activeMedications,
  followUps,
  onSaveNoteDraft,
  onSignNote,
  onAddAddendum,
  onOpenPrescriptionModal,
  onOpenSchedule,
  onOpenFollowUpModal,
  canEditClinical,
  canPrescribe,
  allDoctors = [],
  onUpdatePatient,
  onAudit,
}) => {
  // Center column view tab: 'soap' (consultation) vs 'trends' (Recharts historical data)
  const [activeCenterTab, setActiveCenterTab] = useState<'soap' | 'trends'>('soap');
  const [, setVitalsVersion] = useState(0);

  // Transfer dialog state
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showReserveDialog, setShowReserveDialog] = useState(false);
  const [reserveReason, setReserveReason] = useState('');

  // Patient reservation hook (reserve / release / transfer)
  const reservation = usePatientReservation({
    currentUser,
    onUpdatePatient: onUpdatePatient || (() => {}),
    onAudit,
  });

  // Quick vital sign recording modal toggle
  const [isRecordingVitals, setIsRecordingVitals] = useState(false);
  const [newBpSys, setNewBpSys] = useState('125');
  const [newBpDia, setNewBpDia] = useState('78');
  const [newPulse, setNewPulse] = useState('72');
  const [newTemp, setNewTemp] = useState('37.0');
  const [newSpo2, setNewSpo2] = useState('98');

  // Local SOAP state for real-time editing
  const [subjective, setSubjective] = useState(clinicalNote.subjective);
  const [objective, setObjective] = useState(clinicalNote.objective);
  const [assessment, setAssessment] = useState(clinicalNote.assessment);
  const [plan, setPlan] = useState(clinicalNote.plan);
  const [followUp, setFollowUp] = useState(clinicalNote.followUp || {});

  // Addendum form
  const [isAddingAddendum, setIsAddingAddendum] = useState(false);
  const [addendumText, setAddendumText] = useState('');
  const [addendumReason, setAddendumReason] = useState('');

  // Copy IPP state
  const [copiedMrn, setCopiedMrn] = useState(false);

  // PDF Export states
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfExportSuccess, setPdfExportSuccess] = useState(false);

  const isSigned = clinicalNote.status === 'signed' || clinicalNote.status === 'amended';

  // Calculate age from birthDate
  const age = Math.floor(
    (new Date().getTime() - new Date(patient.birthDate).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000)
  );

  // Get most recent vital signs record
  const latestVitals = [...patient.vitalsHistory].sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
  )[0];

  const handleCopyMrn = () => {
    navigator.clipboard.writeText(patient.medicalRecordNumber);
    setCopiedMrn(true);
    setTimeout(() => setCopiedMrn(false), 2000);
  };

  const handleRecordNewVitals = () => {
    const sys = parseInt(newBpSys, 10) || 120;
    const dia = parseInt(newBpDia, 10) || 80;
    const pulse = parseInt(newPulse, 10) || 72;
    const temp = parseFloat(newTemp) || 37.0;
    const spo2 = parseInt(newSpo2, 10) || 98;
    const weight = latestVitals?.weightKg || 65;
    const height = latestVitals?.heightCm || 168;
    const heightM = height / 100;
    const bmi = +(weight / (heightM * heightM)).toFixed(1);

    const newSet: VitalSignSet = {
      id: 'vit_' + Date.now(),
      measuredAt: new Date().toISOString(),
      measuredBy: currentUser.displayName,
      systolic: sys,
      diastolic: dia,
      pulseBpm: pulse,
      temperatureC: temp,
      oxygenSaturation: spo2,
      weightKg: weight,
      heightCm: height,
      bmi,
    };

    patient.vitalsHistory.push(newSet);
    setVitalsVersion((v) => v + 1);
    setIsRecordingVitals(false);
  };

  const handleSaveDraft = () => {
    onSaveNoteDraft({
      ...clinicalNote,
      subjective,
      objective,
      assessment,
      plan,
      followUp,
      status: 'draft',
      authoredByName: currentUser.displayName,
    });
  };

  const handleSign = () => {
    onSignNote({
      ...clinicalNote,
      subjective,
      objective,
      assessment,
      plan,
      followUp,
      status: 'signed',
      signedAt: new Date().toISOString(),
      signedBy: currentUser.id,
      authoredByName: currentUser.displayName,
    });
  };

  const handleSubmitAddendum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addendumText.trim() || !addendumReason.trim()) return;

    onAddAddendum({
      encounterId: clinicalNote.encounterId,
      originalNoteId: clinicalNote.id,
      text: addendumText.trim(),
      reason: addendumReason.trim(),
      authoredBy: currentUser.id,
      authoredByName: currentUser.displayName,
    });

    setAddendumText('');
    setAddendumReason('');
    setIsAddingAddendum(false);
  };

  const handleExportPdf = () => {
    try {
      setIsExportingPdf(true);
      const noteToExport: ClinicalNote = {
        ...clinicalNote,
        subjective,
        objective,
        assessment,
        plan,
        followUp,
        authoredByName: clinicalNote.authoredByName || currentUser.displayName,
      };

      exportPatientDossierPdf({
        patient,
        clinicalNote: noteToExport,
        addenda,
        activeMedications,
        currentUser,
      });

      setPdfExportSuccess(true);
      setTimeout(() => setPdfExportSuccess(false), 3000);
    } catch (err) {
      console.error('Erreur lors de l\'exportation du dossier patient en PDF :', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-5 h-full">
      {/* ======================================================== */}
      {/* ZONE 1 : COLONNE PATIENT (Identité, Allergies, Constantes) */}
      {/* ======================================================== */}
      <div className="col-span-12 lg:col-span-3 space-y-4">
        {/* Fiche Patient Principal */}
        <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical transition-colors">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleCopyMrn}
              className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-0.5 transition-colors"
              title="Copier l'identifiant patient IPP"
            >
              <span>{patient.medicalRecordNumber}</span>
              {copiedMrn ? (
                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3 text-slate-400" />
              )}
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-2 py-0.5 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                title="Exporter le dossier patient en PDF certifié HDS"
              >
                <FileDown className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span>PDF</span>
              </button>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Dossier Actif
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-base shadow-sm shrink-0">
              {patient.givenName[0]}
              {patient.familyName[0]}
            </div>

            <div className="min-w-0 flex-1">
              <select
                value={patient.id}
                onChange={(e) => onSelectPatient(e.target.value)}
                className="w-full text-base font-extrabold text-slate-900 dark:text-white bg-transparent border-0 p-0 focus:ring-0 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate"
              >
                {patientsList.map((p) => (
                  <option key={p.id} value={p.id} className="dark:bg-slate-900 dark:text-white">
                    {p.familyName.toUpperCase()} {p.givenName}
                  </option>
                ))}
              </select>

              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{age} ans</span>
                <span>·</span>
                <span>Né(e) le {new Date(patient.birthDate).toLocaleDateString('fr-FR')}</span>
                <span>·</span>
                <span className="font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded text-[10px] border border-blue-200 dark:border-blue-800">
                  {patient.bloodGroup}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3.5 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 dark:text-slate-500">Téléphone :</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums">{patient.phone}</span>
            </div>
            <div className="flex items-center justify-between truncate">
              <span className="text-slate-400 dark:text-slate-500">Couverture :</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate ml-2">{patient.insurance.provider}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 dark:text-slate-500">Contact d'urgence :</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{patient.emergencyContact.name} ({patient.emergencyContact.relationship})</span>
            </div>
          </div>
        </div>

        {/* Bloc Allergies & Intolérances (Sécurité Médicale Critique) */}
        <div
          className={` border p-4 shadow-clinical transition-all ${
            patient.allergies.length > 0
              ? 'border-red-300 dark:border-red-900/60 bg-gradient-to-b from-red-50/80 dark:from-red-950/40 to-white dark:to-slate-900'
              : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {patient.allergies.length > 0 ? (
                <div className="flex h-7 w-7 items-center justify-center bg-red-600 text-white shadow-xs">
                  <AlertOctagon className="h-4 w-4" />
                </div>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              )}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Allergies & Intolérances
                </h3>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Vérification obligatoire avant prescription</span>
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-mono font-bold ${
                patient.allergies.length > 0
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {patient.allergies.length}
            </span>
          </div>

          {patient.allergies.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 p-2.5 border border-slate-100 dark:border-slate-800">
              Aucune allergie documentée à ce jour.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {patient.allergies.map((allergy) => (
                <div
                  key={allergy.id}
                  className="border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900/90 p-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-red-950 dark:text-red-200">
                      {allergy.substanceDisplay}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/60 px-2 py-0.5 border border-red-200 dark:border-red-800">
                      {allergy.severity === 'critical' ? 'Critique' : allergy.severity}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                    {allergy.reaction}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Constantes vitales récentes & Moniteur */}
        <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Dernières Constantes
                </h3>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Prise en charge du jour</span>
              </div>
            </div>
            {canEditClinical && (
              <button
                type="button"
                onClick={() => setIsRecordingVitals(!isRecordingVitals)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-1 border border-blue-200 dark:border-blue-800 transition-colors"
              >
                + Saisir
              </button>
            )}
          </div>

          {/* Real-time Clinical Alerts Alert Box if abnormal vitals */}
          {(() => {
            const vitalsAlerts = analyzePatientVitals(patient);
            if (vitalsAlerts.length === 0) return null;
            return (
              <div className="mt-3 p-3 border border-rose-300 dark:border-rose-900 bg-rose-50/90 dark:bg-rose-950/50 text-xs space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-1.5 font-extrabold text-rose-800 dark:text-rose-200">
                  <AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
                  <span>Alerte Clinique Constantes ({vitalsAlerts.length})</span>
                </div>
                {vitalsAlerts.map((alt) => (
                  <div key={alt.id} className="text-[11px] text-rose-950 dark:text-rose-200 leading-tight">
                    <span className="font-black text-rose-700 dark:text-rose-300">⚠️ {alt.badgeLabel} ({alt.valueDisplay}) :</span>{' '}
                    <span>{alt.recommendation}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {latestVitals ? (
            <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
              {(() => {
                const vitalsAlerts = analyzePatientVitals(patient);
                const hasBpAlert = vitalsAlerts.some((a) => a.category === 'blood_pressure');
                const hasPulseAlert = vitalsAlerts.some((a) => a.category === 'pulse');
                const hasSpo2Alert = vitalsAlerts.some((a) => a.category === 'oxygen_saturation');

                return (
                  <>
                    <div className={` p-2.5 border transition-colors ${
                      hasBpAlert
                        ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pression Artérielle</span>
                        {hasBpAlert && <AlertOctagon className="h-3 w-3 text-rose-600 animate-pulse" />}
                      </div>
                      <p className={`text-base font-extrabold font-mono mt-0.5 tabular-nums ${hasBpAlert ? 'text-rose-600 dark:text-rose-300' : 'text-slate-900 dark:text-slate-100'}`}>
                        {latestVitals.systolic}/{latestVitals.diastolic}{' '}
                        <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">mmHg</span>
                      </p>
                    </div>

                    <div className={` p-2.5 border transition-colors ${
                      hasPulseAlert
                        ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pouls de Repos</span>
                        {hasPulseAlert && <AlertOctagon className="h-3 w-3 text-rose-600 animate-pulse" />}
                      </div>
                      <p className={`text-base font-extrabold font-mono mt-0.5 tabular-nums ${hasPulseAlert ? 'text-rose-600 dark:text-rose-300' : 'text-slate-900 dark:text-slate-100'}`}>
                        {latestVitals.pulseBpm}{' '}
                        <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">bpm</span>
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Température</span>
                      <p className="text-base font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                        {latestVitals.temperatureC}°C
                      </p>
                    </div>

                    <div className={` p-2.5 border transition-colors ${
                      hasSpo2Alert
                        ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Saturation SpO₂</span>
                        {hasSpo2Alert && <AlertOctagon className="h-3 w-3 text-rose-600 animate-pulse" />}
                      </div>
                      <p className={`text-base font-extrabold font-mono mt-0.5 tabular-nums ${hasSpo2Alert ? 'text-rose-600 dark:text-rose-300' : 'text-slate-900 dark:text-slate-100'}`}>
                        {latestVitals.oxygenSaturation}%
                      </p>
                    </div>

                    <div className="col-span-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Poids & Taille :</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {latestVitals.weightKg} kg · {latestVitals.heightCm} cm{' '}
                        <span className="text-slate-500 dark:text-slate-400 font-normal">(IMC {latestVitals.bmi})</span>
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic">Aucune constante enregistrée.</p>
          )}

          {/* Direct CTA button to switch to Recharts trends */}
          <button
            type="button"
            onClick={() => setActiveCenterTab('trends')}
            className={`mt-3 w-full flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all shadow-xs ${
              activeCenterTab === 'trends'
                ? 'bg-blue-600 text-white shadow-blue-500/20'
                : 'border border-blue-200 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Tendances & Graphiques Recharts ({patient.vitalsHistory.length})</span>
          </button>

          {isRecordingVitals && (
            <div className="mt-3.5 p-3.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs space-y-2.5 animate-fadeIn">
              <p className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Saisie rapide des constantes
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="TA Sys"
                  value={newBpSys}
                  onChange={(e) => setNewBpSys(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  placeholder="TA Dia"
                  value={newBpDia}
                  onChange={(e) => setNewBpDia(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  placeholder="Pouls (bpm)"
                  value={newPulse}
                  onChange={(e) => setNewPulse(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  placeholder="SpO₂ (%)"
                  value={newSpo2}
                  onChange={(e) => setNewSpo2(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
              <button
                type="button"
                onClick={handleRecordNewVitals}
                className="w-full bg-blue-600 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer"
              >
                Valider & Actualiser les courbes
              </button>
            </div>
          )}
        </div>

        {/* Pathologies Actives CIM-10 */}
        <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical transition-colors">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
            Pathologies Actives (CIM-10)
          </h3>
          <ul className="mt-2.5 space-y-2 text-xs">
            {patient.problems.map((prob) => (
              <li key={prob.id} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 border border-slate-100 dark:border-slate-800">
                <span className="font-mono text-[10px] font-bold text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/70 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 shrink-0">
                  {prob.code}
                </span>
                <span className="text-slate-800 dark:text-slate-200 font-medium leading-snug">{prob.display}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ZONE 2 : ZONE CENTRALE (SOAP Structuré ou Tendances Recharts) */}
      {/* ======================================================== */}
      <div className="col-span-12 lg:col-span-6 space-y-3">
        {/* Navigation Onglets Zone Centrale */}
        <div className="flex items-center justify-between border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 shadow-clinical transition-colors">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveCenterTab('soap')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeCenterTab === 'soap'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Stethoscope className="h-4 w-4" />
              <span>Consultation Médicale (SOAP)</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  activeCenterTab === 'soap'
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {isSigned ? 'Signée' : 'Brouillon'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCenterTab('trends')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeCenterTab === 'trends'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span>Courbes d'Évolution (Recharts)</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  activeCenterTab === 'trends'
                    ? 'bg-blue-700 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                }`}
              >
                {patient.vitalsHistory.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden md:block">
              Patient : <span className="font-bold text-slate-900 dark:text-slate-100">{patient.familyName.toUpperCase()} {patient.givenName}</span>
            </div>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
              title="Exporter l'ensemble du dossier patient au format PDF certifié HDS"
            >
              {pdfExportSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-white" />
                  <span>PDF Prêt !</span>
                </>
              ) : isExportingPdf ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                  <span>Génération...</span>
                </>
              ) : (
                <>
                  <FileDown className="h-3.5 w-3.5" />
                  <span>Export Dossier PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Toggle : Trends or SOAP Form */}
        {activeCenterTab === 'trends' ? (
          <PatientVitalsTrends
            patient={patient}
            onAddVitalsClick={() => setIsRecordingVitals(true)}
          />
        ) : (
          <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-clinical flex flex-col h-full overflow-hidden transition-colors">
            {/* Header consultation */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50/70 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                    Dossier d'Épisode Clinique (Méthode SOAP)
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Auteur : {clinicalNote.authoredByName} ({currentUser.licenseNumber || 'RPPS'})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold border bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                  title="Télécharger le compte-rendu médical officiel en PDF"
                >
                  <FileDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>PDF Dossier</span>
                </button>

                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 border ${
                    isSigned
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {isSigned ? (
                    <>
                      <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Signée v{clinicalNote.noteVersion} (Immuable)
                    </>
                  ) : (
                    <>
                      <FileEdit className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      Brouillon v{clinicalNote.noteVersion} (Éditable)
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Formulaire SOAP */}
            <div className="p-5 space-y-4 flex-1">
              {/* S - Subjective */}
              <div className="border border-blue-100 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-950/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center bg-blue-600 text-white font-bold text-[10px]">
                      S
                    </span>
                    Motif de Consultation & Anamnèse (Subjectif)
                  </label>
                </div>
                <textarea
                  disabled={isSigned || !canEditClinical}
                  rows={2}
                  value={subjective.chiefComplaint}
                  onChange={(e) =>
                    setSubjective((p) => ({ ...p, chiefComplaint: e.target.value }))
                  }
                  placeholder="Motif de la consultation exprimé par le patient..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 shadow-2xs"
                />
                <textarea
                  disabled={isSigned || !canEditClinical}
                  rows={2}
                  value={subjective.historyOfPresentIllness}
                  onChange={(e) =>
                    setSubjective((p) => ({ ...p, historyOfPresentIllness: e.target.value }))
                  }
                  placeholder="Histoire de la maladie, antériorité des symptômes, facteurs déclenchants..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 shadow-2xs"
                />
              </div>

              {/* O - Objective */}
              <div className="border border-teal-100 dark:border-teal-900/30 bg-teal-50/20 dark:bg-teal-950/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-teal-900 dark:text-teal-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center bg-teal-600 text-white font-bold text-[10px]">
                      O
                    </span>
                    Examen Clinique & Données Biométriques (Objectif)
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveCenterTab('trends')}
                    className="text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-100 flex items-center gap-1 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                  >
                    <TrendingUp className="h-3 w-3" />
                    <span>Courbes Recharts (TA, Pouls, Poids)</span>
                  </button>
                </div>
                <textarea
                  disabled={isSigned || !canEditClinical}
                  rows={3}
                  value={objective.physicalExam}
                  onChange={(e) =>
                    setObjective((p) => ({ ...p, physicalExam: e.target.value }))
                  }
                  placeholder="Signes physiques constatés, auscultation, examen cutané, constantes du jour..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-teal-500 dark:focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900/30 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 shadow-2xs"
                />
              </div>

              {/* A - Assessment */}
              <div className="border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/20 dark:bg-indigo-950/20 p-3.5 space-y-2">
                <label className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center bg-indigo-600 text-white font-bold text-[10px]">
                    A
                  </span>
                  Synthèse Diagnostique & Hypothèses (Assessment)
                </label>
                <textarea
                  disabled={isSigned || !canEditClinical}
                  rows={2}
                  value={assessment.clinicalEvaluation}
                  onChange={(e) =>
                    setAssessment((p) => ({ ...p, clinicalEvaluation: e.target.value }))
                  }
                  placeholder="Synthèse diagnostique, stade de sévérité, codage CIM-10 correspondant..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 shadow-2xs"
                />
              </div>

              {/* P - Plan */}
              <div className="border border-purple-100 dark:border-purple-900/30 bg-purple-50/20 dark:bg-purple-950/20 p-3.5 space-y-2">
                <label className="text-xs font-extrabold text-purple-900 dark:text-purple-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center bg-purple-600 text-white font-bold text-[10px]">
                    P
                  </span>
                  Plan Thérapeutique & Conduite à Tenir (Plan)
                </label>
                <textarea
                  disabled={isSigned || !canEditClinical}
                  rows={3}
                  value={plan.treatmentPlan}
                  onChange={(e) =>
                    setPlan((p) => ({ ...p, treatmentPlan: e.target.value }))
                  }
                  placeholder="Prescription médicamenteuse, examens complémentaires, conseils hygiéno-diététiques, délai de reconsultation..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 shadow-2xs"
                />
              </div>

              {/* Addendums si note signée */}
              {isSigned && (
                <div className="mt-4 border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Addendums Cliniques & Compléments ({addenda.length})
                      </h3>
                    </div>
                    {canEditClinical && !isAddingAddendum && (
                      <button
                        type="button"
                        onClick={() => setIsAddingAddendum(true)}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Rédiger un addendum
                      </button>
                    )}
                  </div>

                  {addenda.map((ad, idx) => (
                    <div
                      key={ad.id || idx}
                      className="mt-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {ad.authoredByName}
                        </span>
                        <span className="tabular-nums">{new Date(ad.authoredAt).toLocaleString('fr-FR')}</span>
                      </div>
                      <p className="font-medium text-slate-900 dark:text-slate-200">{ad.text}</p>
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 italic">
                        Motif : {ad.reason}
                      </p>
                    </div>
                  ))}

                  {isAddingAddendum && (
                    <form onSubmit={handleSubmitAddendum} className="mt-3.5 space-y-2.5 bg-white dark:bg-slate-900 p-4 border border-blue-200 dark:border-blue-900/60 shadow-xs">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Nouvel Addendum Clinique (Scellé dans le journal d'audit HDS)
                      </p>
                      <textarea
                        required
                        rows={2}
                        value={addendumText}
                        onChange={(e) => setAddendumText(e.target.value)}
                        placeholder="Complément d'information ou précision clinique..."
                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <input
                        required
                        type="text"
                        value={addendumReason}
                        onChange={(e) => setAddendumReason(e.target.value)}
                        placeholder="Motif réglementaire de l'addendum..."
                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingAddendum(false)}
                          className="border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                        >
                          Enregistrer l'addendum
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Footer action bar */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/50">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {isSigned ? (
                  <span className="flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Consultation validée et scellée
                  </span>
                ) : (
                  <span>Brouillon sauvegardé localement</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                  title="Exporter le compte-rendu médical et le dossier patient en PDF"
                >
                  {pdfExportSuccess ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>PDF Téléchargé !</span>
                    </>
                  ) : isExportingPdf ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <span>Génération...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Exporter en PDF</span>
                    </>
                  )}
                </button>

                {!isSigned && canEditClinical && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      Enregistrer le brouillon
                    </button>
                    <button
                      type="button"
                      onClick={handleSign}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                    >
                      Signer la consultation
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* ZONE 3 : PANNEAU CONTEXTUEL (Traitements, Examens, Actions) */}
      {/* ======================================================== */}
      <div className="col-span-12 lg:col-span-3 space-y-4">
        {/* Actions Rapides */}
        <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical space-y-2.5 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Actions Cliniques
            </h3>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              Certifié HDS
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {/* Bouton d'Action Principal : Exporter le Dossier en PDF */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="w-full flex items-center justify-between bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 hover:from-emerald-700 hover:via-teal-700 hover:to-cyan-800 p-3 text-xs font-bold text-white shadow-md shadow-emerald-500/25 transition-all cursor-pointer group"
              title="Exporter l'intégralité du dossier patient (notes SOAP, ordonnances, antécédents, constantes) en PDF conforme HDS"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center bg-white/20 backdrop-blur-xs group-hover:scale-105 transition-transform shrink-0">
                  {pdfExportSuccess ? (
                    <Check className="h-4 w-4 text-white" />
                  ) : isExportingPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <FileDown className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className="text-left">
                  <span className="block text-xs font-extrabold tracking-tight leading-tight">
                    {pdfExportSuccess ? 'Dossier PDF Téléchargé !' : isExportingPdf ? 'Génération du PDF...' : 'Exporter le Dossier (PDF)'}
                  </span>
                  <span className="block text-[10px] text-emerald-100 font-medium leading-none mt-0.5">
                    Notes, prescriptions & antécédents
                  </span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-emerald-200 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            {canPrescribe && (
              <button
                type="button"
                onClick={onOpenPrescriptionModal}
                className="w-full flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 p-3 text-xs font-bold text-white hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4" />
                  <span>Prescrire un traitement</span>
                </div>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenSchedule}
              className="w-full flex items-center justify-between border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/70 p-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Planifier un rendez-vous</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={onOpenFollowUpModal}
              className="w-full flex items-center justify-between border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/70 p-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <span>Créer un suivi patient</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* === Boutons Réservation / Transfert (visibles si onUpdatePatient fourni) === */}
            {onUpdatePatient && (
              <>
                {/* Patient réservé → afficher "Libérer" + "Transférer" */}
                {patient.isReserved && patient.reservedById === currentUser.id ? (
                  <>
                    {/* Statut réservé */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-bold">
                        Patient réservé{patient.reservedReason ? ` : ${patient.reservedReason}` : ''}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowTransferDialog(true)}
                      className="w-full flex items-center justify-between border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-2.5 text-xs font-semibold text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span>Transférer le patient</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-blue-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => reservation.releasePatient(patient.id)}
                      className="w-full flex items-center justify-between border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Unlock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Libérer le patient</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
                    </button>
                  </>
                ) : patient.isReserved && patient.reservedById !== currentUser.id ? (
                  /* Patient réservé par un autre médecin → afficher qui */
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400">
                    <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>
                      Réservé par <strong className="text-slate-900 dark:text-slate-100">{patient.reservedByName}</strong>
                      {patient.reservedReason ? ` — ${patient.reservedReason}` : ''}
                    </span>
                  </div>
                ) : currentUser.role === 'doctor' || currentUser.role === 'medical_director' ? (
                  /* Patient non réservé → bouton "Réserver" */
                  <button
                    type="button"
                    onClick={() => setShowReserveDialog(true)}
                    className="w-full flex items-center justify-between border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span>Réserver le patient</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
                  </button>
                ) : null}

                {/* Patient en attente de transfert vers moi → bouton Accepter/Refuser */}
                {patient.pendingTransferToId === currentUser.id && (
                  <div className="p-3 border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 space-y-2">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-blue-800 dark:text-blue-300">
                      <ArrowRightLeft className="h-4 w-4" />
                      <span>Transfert en attente — acceptez pour devenir le médecin titulaire</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => reservation.acceptTransfer(patient)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 text-xs font-bold transition-colors"
                      >
                        ✓ Accepter
                      </button>
                      <button
                        type="button"
                        onClick={() => reservation.declineTransfer(patient)}
                        className="flex-1 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        ✗ Refuser
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Traitements Actifs */}
        <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                <Pill className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Traitements Actifs
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 tabular-nums">
              {activeMedications.length}
            </span>
          </div>

          <div className="mt-3.5 space-y-2">
            {activeMedications.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-100 dark:border-slate-800">
                Aucun traitement actif en cours.
              </p>
            ) : (
              activeMedications.map((order) => (
                <div
                  key={order.id}
                  className="border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-3 text-xs space-y-1 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {order.medicationDisplay}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2">
                      Actif
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-[11px] font-medium">{order.dosage}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Prescrit par {order.prescriberName}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Suivis & Tâches ouvertes */}
        <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                <ClipboardList className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Suivis Programmés
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 tabular-nums">
              {followUps.filter((f) => f.patientId === patient.id).length}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {followUps
              .filter((f) => f.patientId === patient.id)
              .map((tsk) => (
                <div
                  key={tsk.id}
                  className="border border-slate-200 dark:border-slate-800 p-2.5 text-xs bg-slate-50/60 dark:bg-slate-800/40 space-y-1 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{tsk.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                        tsk.priority === 'urgent'
                          ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                          : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                      }`}
                    >
                      {tsk.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">{tsk.objective}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    Échéance : {new Date(tsk.dueAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Dialogue de transfert de patient */}
      {showTransferDialog && (
        <TransferPatientDialog
          patient={patient}
          currentUser={currentUser}
          doctors={allDoctors}
          onTransfer={reservation.transferPatient}
          onRelease={reservation.releasePatient}
          onClose={() => setShowTransferDialog(false)}
        />
      )}

      {/* Dialogue de réservation (saisie du motif) */}
      {showReserveDialog && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-fadeInScale">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Réserver le patient
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 ml-7">
                {patient.familyName} {patient.givenName} sera réservé à votre nom.
              </p>
            </div>
            <div className="p-5">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Motif de réservation
              </label>
              <textarea
                value={reserveReason}
                onChange={(e) => setReserveReason(e.target.value)}
                placeholder="ex: Suivi cardiologique long terme, patient vulnérable..."
                rows={3}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none resize-none"
                autoFocus
              />
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (reserveReason.trim()) {
                      reservation.reservePatient(patient, reserveReason.trim());
                      setReserveReason('');
                      setShowReserveDialog(false);
                    }
                  }}
                  disabled={!reserveReason.trim()}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2 text-xs font-bold transition-colors"
                >
                  🔒 Réserver
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReserveDialog(false);
                    setReserveReason('');
                  }}
                  className="flex-1 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck,
  X,
  CheckCircle2,
} from 'lucide-react';
import {
  Patient,
  MedicationCatalogItem,
  MedicationOrder,
  AppUser,
} from '../types/clinical';
import {
  evaluateMedicationSafety,
  ENGINE_VERSION,
  KNOWLEDGE_VERSION,
} from '../services/clinicalEngine';

interface PrescriptionSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  catalog: MedicationCatalogItem[];
  activeMedications: MedicationOrder[];
  currentUser: AppUser;
  onSavePrescription: (order: MedicationOrder) => void;
  isOnline: boolean;
}

export const PrescriptionSafetyModal: React.FC<PrescriptionSafetyModalProps> = ({
  isOpen,
  onClose,
  patient,
  catalog,
  activeMedications,
  currentUser,
  onSavePrescription,
  isOnline,
}) => {
  const [selectedMedId, setSelectedMedId] = useState<string>(catalog[0]?.id || '');
  const [dosage, setDosage] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('2 fois par jour');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [route, setRoute] = useState<string>('Orale');
  const [clinicalIndication, setClinicalIndication] = useState<string>('');
  const [patientInstructions, setPatientInstructions] = useState<string>('');
  const [overrideChecked, setOverrideChecked] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  // Safety checklist states
  const [checklist, setChecklist] = useState({
    identityVerified: true,
    allergiesReviewed: true,
    doseVerified: false,
    counselingGiven: false,
  });

  const selectedMed = useMemo(() => {
    return catalog.find((m) => m.id === selectedMedId);
  }, [catalog, selectedMedId]);

  // Update default fields when medication changes
  const handleMedChange = (medId: string) => {
    setSelectedMedId(medId);
    setOverrideChecked(false);
    setOverrideReason('');
    const med = catalog.find((m) => m.id === medId);
    if (med) {
      setDosage(med.standardDose);
      setFrequency(med.standardFrequency);
      setDurationDays(med.standardDurationDays);
      setRoute(med.routeOptions[0] || 'Orale');
      setPatientInstructions('À prendre de préférence au cours du repas avec un grand verre d\'eau.');
    }
  };

  // Initialize once
  React.useEffect(() => {
    if (selectedMed && !dosage) {
      setDosage(selectedMed.standardDose);
      setFrequency(selectedMed.standardFrequency);
      setDurationDays(selectedMed.standardDurationDays);
      setRoute(selectedMed.routeOptions[0] || 'Orale');
      setPatientInstructions('À prendre de préférence au cours du repas avec un grand verre d\'eau.');
    }
  }, [selectedMed, dosage]);

  // Moteur de règles en direct
  const safetyEvaluation = useMemo(() => {
    if (!selectedMed) return null;
    return evaluateMedicationSafety(patient, selectedMed, activeMedications);
  }, [patient, selectedMed, activeMedications]);

  if (!isOpen || !selectedMed) return null;

  const hasCriticalFindings = safetyEvaluation?.findings.some((f) => f.severity === 'critical');
  const hasMajorFindings = safetyEvaluation?.findings.some((f) => f.severity === 'major');

  const canSign =
    checklist.identityVerified &&
    checklist.allergiesReviewed &&
    checklist.doseVerified &&
    (!hasCriticalFindings || (overrideChecked && overrideReason.trim().length >= 10));

  const toggleEvidence = (ruleId: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [ruleId]: !prev[ruleId] }));
  };

  const handleSign = () => {
    if (!canSign) return;

    const newOrder: MedicationOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      patientId: patient.id,
      medicationId: selectedMed.id,
      medicationDisplay: selectedMed.displayName,
      genericName: selectedMed.genericName,
      dosage,
      route,
      frequency,
      durationDays,
      quantity: `${durationDays * 2} unités`,
      refills: 0,
      patientInstructions,
      clinicalIndication: clinicalIndication || 'Indication clinique documentée en consultation',
      prescriberId: currentUser.id,
      prescriberName: currentUser.displayName,
      authoredOn: new Date().toISOString(),
      status: 'active',
      signedAt: new Date().toISOString(),
      signedBy: currentUser.id,
      overrideReason: hasCriticalFindings ? overrideReason : undefined,
      ruleWarnings: safetyEvaluation?.findings,
    };

    onSavePrescription(newOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="my-8 w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl transition-colors">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/70 dark:bg-slate-800/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Prescription Électronique Structurée
                </h2>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${
                    isOnline
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {isOnline ? 'En ligne — Validation active' : 'Hors ligne — Règles locales v2026.09'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Patient : <span className="font-semibold text-slate-900 dark:text-slate-200">{patient.familyName} {patient.givenName}</span> (IPP : {patient.medicalRecordNumber}) · Prescripteur : {currentUser.displayName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* 1. Sélection médicament & posologie */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Médicament du catalogue clinique
              </label>
              <select
                value={selectedMedId}
                onChange={(e) => handleMedChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                {catalog.map((med) => (
                  <option key={med.id} value={med.id} className="dark:bg-slate-900 dark:text-slate-100">
                    {med.displayName} — {med.category} ({med.genericName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Posologie & Forme
              </label>
              <input
                type="text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="Ex: 1 comprimé matin et soir"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fréquence
              </label>
              <input
                type="text"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Durée du traitement (jours)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Voie d'administration
              </label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                {selectedMed.routeOptions.map((r) => (
                  <option key={r} value={r} className="dark:bg-slate-900 dark:text-slate-100">
                    Voie {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Indication clinique
              </label>
              <input
                type="text"
                value={clinicalIndication}
                onChange={(e) => setClinicalIndication(e.target.value)}
                placeholder="Ex: Angine bactérienne suspectée / Poussée hypertensive"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Instructions pour le patient
              </label>
              <textarea
                rows={2}
                value={patientInstructions}
                onChange={(e) => setPatientInstructions(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 2. Alertes du Moteur de Sécurité Clinique */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Contrôle de sécurité clinique (Moteur v{ENGINE_VERSION} · {KNOWLEDGE_VERSION})
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {safetyEvaluation?.findings.length || 0} règle(s) évaluée(s)
              </span>
            </div>

            {safetyEvaluation && safetyEvaluation.findings.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/40 p-4 flex items-center gap-3 text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold">Aucune contre-indication ou interaction critique détectée</p>
                  <p className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                    Vérification effectuée avec les allergies actives et les traitements en cours du patient.
                  </p>
                </div>
              </div>
            ) : null}

            {safetyEvaluation?.findings.map((finding) => {
              const isCritical = finding.severity === 'critical';
              const isMajor = finding.severity === 'major';
              const isExpanded = !!expandedEvidence[finding.ruleId];

              return (
                <div
                  key={finding.ruleId}
                  className={`rounded-2xl border p-4 transition-all ${
                    isCritical
                      ? 'border-red-300 dark:border-red-900/60 bg-red-50/90 dark:bg-red-950/40 text-red-950 dark:text-red-200'
                      : isMajor
                      ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200'
                      : 'border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {isCritical ? (
                        <AlertOctagon className="h-5 w-5 text-red-600 dark:text-red-400" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isCritical
                              ? 'bg-red-200/80 dark:bg-red-900/80 text-red-900 dark:text-red-100'
                              : 'bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100'
                          }`}
                        >
                          {isCritical ? 'Blocage Critique — Allergie Avérée' : 'Alerte Majeure'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          Règle : {finding.ruleId}
                        </span>
                      </div>
                      <h4 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                        {finding.title}
                      </h4>
                      <p className="mt-1 text-xs text-slate-800 dark:text-slate-300 leading-relaxed">
                        {finding.message}
                      </p>

                      {/* Accordéon de preuve technique */}
                      <button
                        type="button"
                        onClick={() => toggleEvidence(finding.ruleId)}
                        className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white underline underline-offset-2 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" />
                            Masquer les éléments de preuve clinique
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            Voir les éléments de preuve et sources ({finding.evidence.length})
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-3 text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                          <p className="font-bold text-slate-900 dark:text-slate-100">Faits cliniques probants :</p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {finding.evidence.map((ev, i) => (
                              <li key={i}>{ev}</li>
                            ))}
                          </ul>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                            Action requise : {finding.action === 'block_unless_overridden' ? 'Signature bloquée sans dérogation motivée et tracée.' : 'Revue médicale recommandée.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Section Override obligatoire si alerte critique */}
            {hasCriticalFindings && (
              <div className="rounded-2xl border border-red-300 dark:border-red-900/60 bg-white dark:bg-slate-900 p-4 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="override-checkbox"
                    checked={overrideChecked}
                    onChange={(e) => setOverrideChecked(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <label htmlFor="override-checkbox" className="text-xs font-semibold text-red-950 dark:text-red-200 cursor-pointer">
                    J'ai pris connaissance de l'alerte critique d'allergie et j'engage ma responsabilité clinique pour justifier la poursuite (Dérogation médicale tracée dans l'Audit Trail HDS).
                  </label>
                </div>

                {overrideChecked && (
                  <div className="mt-3 pl-6">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Motif médical impérieux de la dérogation (obligatoire, min. 10 caractères) :
                    </label>
                    <textarea
                      rows={2}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Ex: Test cutané négatif récent sous contrôle allergologue / Prescription sous surveillance hospitalière stricte..."
                      className="w-full rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/40 p-2 text-xs text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      Ce motif sera scellé avec votre identifiant RPPS dans le journal d'audit immuable.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Checklist de sécurité progressive */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Checklist de validation de la prescription
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-slate-700 dark:text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.identityVerified}
                  onChange={(e) =>
                    setChecklist((p) => ({ ...p, identityVerified: e.target.checked }))
                  }
                  className="rounded text-blue-600"
                />
                <span>Identité patient vérifiée (IPP {patient.medicalRecordNumber})</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.allergiesReviewed}
                  onChange={(e) =>
                    setChecklist((p) => ({ ...p, allergiesReviewed: e.target.checked }))
                  }
                  className="rounded text-blue-600"
                />
                <span>Allergies et antécédents consultés</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.doseVerified}
                  onChange={(e) =>
                    setChecklist((p) => ({ ...p, doseVerified: e.target.checked }))
                  }
                  className="rounded text-blue-600"
                />
                <span className="font-semibold text-slate-900 dark:text-slate-100">Posologie, voie et durée vérifiées *</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.counselingGiven}
                  onChange={(e) =>
                    setChecklist((p) => ({ ...p, counselingGiven: e.target.checked }))
                  }
                  className="rounded text-blue-600"
                />
                <span>Consignes de prise expliquées au patient</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/70 dark:bg-slate-800/50 rounded-b-2xl">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {hasCriticalFindings && !overrideChecked && (
              <span className="text-red-600 dark:text-red-400 font-semibold">
                Signature bloquée : allergie critique non levée.
              </span>
            )}
            {!checklist.doseVerified && (
              <span className="text-slate-500 dark:text-slate-400">
                Cochez la validation de la posologie pour signer.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!canSign}
              onClick={handleSign}
              className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer ${
                canSign
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-500 dark:text-slate-600'
              }`}
            >
              Signer et valider l'ordonnance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  Search,
  ShieldCheck,
  PenLine,
  Check,
  ChevronRight,
  ChevronLeft,
  Pill,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { MedicationCatalogItem, Patient, MedicationOrder } from '../../types/clinical';
import { evaluateAllergyRisk } from '../../services/allergyMatchingService';
import { toast } from '../../stores/toastStore';

/**
 * Stepper visuel pour la prescription — remplace la modale monolithique de 804 lignes
 *
 * Architecture :
 *  - Étape 1 : Sélection du médicament (recherche catalogue + saisie libre)
 *  - Étape 2 : Alertes de sécurité automatiques (allergies ATC + interactions)
 *  - Étape 3 : Posologie, instructions 80mm POS et signature
 *
 * Le composant parent PrescriptionSafetyModal conserve la logique de soumission,
 * ce composant gère uniquement la navigation visuelle entre les étapes.
 *
 * Avantages UX :
 *  - Réduction de la charge cognitive (1 décision par écran)
 *  - Indicateur de progression visuel
 *  - Validation bloquante à chaque étape
 *  - Possibilité de revenir en arrière sans perdre les saisies
 */

type Step = 1 | 2 | 3;

interface StepperProps {
  patient: Patient;
  catalog: MedicationCatalogItem[];
  entryMode: 'catalog' | 'custom';
  selectedMedId: string;
  customProductName: string;
  customGenericName: string;
  customCategory: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  route: string;
  quantity: string;
  prescriptionReason: string;
  isNarcotic: boolean;
  currentUser: { id: string; displayName: string };
  onChange: (updates: Partial<StepperProps>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  children?: React.ReactNode;
}

const STEPS = [
  { id: 1 as Step, label: 'Médicament', icon: Search, description: 'Sélection' },
  { id: 2 as Step, label: 'Sécurité', icon: ShieldCheck, description: 'Alertes' },
  { id: 3 as Step, label: 'Posologie', icon: PenLine, description: 'Signature' },
];

export const PrescriptionStepper: React.FC<StepperProps> = ({
  patient,
  catalog,
  entryMode,
  selectedMedId,
  customProductName,
  customGenericName,
  customCategory,
  dosage,
  frequency,
  durationDays,
  route,
  quantity,
  prescriptionReason,
  isNarcotic,
  currentUser,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting,
  children,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Médicament actif dérivé (catalogue ou saisie libre)
  const activeMed: MedicationCatalogItem | null = useMemo(() => {
    if (entryMode === 'custom') {
      if (!customProductName.trim()) return null;
      return {
        id: `custom_${Date.now()}`,
        code: 'CUSTOM_ENTRY',
        atcCode: 'CUSTOM',
        displayName: customProductName.trim(),
        genericName: customGenericName.trim() || customProductName.trim(),
        category: customCategory || 'Spécialité',
        form: 'À préciser',
        strength: dosage || 'À préciser',
        standardDose: dosage || '1 prise',
        standardFrequency: frequency || '2 fois par jour',
        standardDurationDays: durationDays || 7,
        routeOptions: ['Orale', 'Injectable', 'Inhalée', 'Cutanée', 'Sublinguale', 'Autre'],
        activeSubstances: [],
        allergenClassCodes: [],
      };
    }
    return catalog.find((m) => m.id === selectedMedId) || null;
  }, [entryMode, customProductName, customGenericName, customCategory, dosage, frequency, durationDays, catalog, selectedMedId]);

  // Évaluation des allergies (ATC strict)
  const allergyResults = useMemo(() => {
    if (!activeMed) return [];
    return evaluateAllergyRisk(patient, activeMed);
  }, [activeMed, patient]);

  const hasCriticalAllergy = allergyResults.some(
    (r) =>
      r.matched &&
      r.matchedAllergy &&
      (r.matchedAllergy.severity === 'critical' || r.matchedAllergy.severity === 'life_threatening')
  );

  // Validation par étape
  const canProceedStep1 = activeMed !== null;
  const canProceedStep2 = !hasCriticalAllergy; // Bloque si allergie critique
  const canSubmit = !!(
    dosage &&
    frequency &&
    durationDays > 0 &&
    route &&
    quantity &&
    (!isNarcotic || prescriptionReason.trim())
  );

  const handleNext = () => {
    if (currentStep === 1 && !canProceedStep1) {
      toast.warning('Sélection requise', 'Veuillez choisir un médicament dans le catalogue ou saisir un nom.');
      return;
    }
    if (currentStep === 2 && !canProceedStep2) {
      toast.error('Allergie critique', 'La prescription est bloquée par une allergie critique. Override requis.');
      return;
    }
    if (currentStep < 3) setCurrentStep((s) => (s + 1) as Step);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep((s) => (s - 1) as Step);
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      toast.warning('Champs manquants', 'Posologie, fréquence, durée et voie sont obligatoires.');
      return;
    }
    onSubmit();
  };

  // Catalogue filtré
  const filteredCatalog = useMemo(() => {
    if (!catalogSearch.trim()) return catalog.slice(0, 12); // Limite pour perf
    const q = catalogSearch.toLowerCase().trim();
    return catalog.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.atcCode && m.atcCode.toLowerCase().includes(q))
    );
  }, [catalog, catalogSearch]);

  return (
    <div className="flex flex-col h-full">
      {/* ============== HEADER : Stepper indicator ============== */}
      <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/70 dark:bg-slate-800/50">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((step, idx) => {
            const isCurrent = currentStep === step.id;
            const isPast = currentStep > step.id;
            const Icon = step.icon;
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => {
                    // Permet de revenir à une étape passée, pas d'avancer sans validation
                    if (step.id < currentStep) setCurrentStep(step.id);
                  }}
                  disabled={step.id > currentStep}
                  className={`flex items-center gap-2.5 px-3 py-2 transition-all ${
                    isCurrent
                      ? 'text-blue-700 dark:text-blue-300'
                      : isPast
                      ? 'text-emerald-700 dark:text-emerald-400 cursor-pointer'
                      : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center border-2 transition-all ${
                      isCurrent
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : isPast
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {isPast ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                      Étape {step.id}
                    </div>
                    <div className="text-xs font-bold">{step.label}</div>
                  </div>
                </button>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 transition-all ${
                      isPast ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ============== CONTENU : Étape courante ============== */}
      <div className="flex-1 overflow-y-auto p-6 animate-fadeIn">
        {/* ---------- ÉTAPE 1 : Sélection ---------- */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                Sélection du médicament
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choisissez dans le catalogue ou saisissez une spécialité libre. Code ATC utilisé pour le matching d'allergies.
              </p>
            </div>

            {/* Mode switch */}
            <div className="inline-flex border border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800 p-0.5 text-xs">
              <button
                onClick={() => onChange({ entryMode: 'catalog' })}
                className={`px-3 py-1.5 font-bold transition-all ${
                  entryMode === 'catalog'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Catalogue
              </button>
              <button
                onClick={() => onChange({ entryMode: 'custom' })}
                className={`px-3 py-1.5 font-bold transition-all ${
                  entryMode === 'custom'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Saisie libre
              </button>
            </div>

            {entryMode === 'catalog' ? (
              <>
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Rechercher par nom, principe actif, classe, code ATC..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                />
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {filteredCatalog.map((med) => (
                    <button
                      key={med.id}
                      onClick={() => onChange({ selectedMedId: med.id })}
                      className={`w-full flex items-center justify-between p-3 text-left border transition-all ${
                        selectedMedId === med.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center ${
                          selectedMedId === med.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          <Pill className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {med.displayName}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {med.genericName} · {med.category}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">
                          ATC {med.atcCode}
                        </span>
                        {selectedMedId === med.id && <Check className="h-4 w-4 text-blue-600" />}
                      </div>
                    </button>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">
                      Aucun médicament trouvé.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Nom du médicament
                  </label>
                  <input
                    type="text"
                    value={customProductName}
                    onChange={(e) => onChange({ customProductName: e.target.value })}
                    placeholder="ex: Amoxicilline 500mg générique"
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Principe actif (générique)
                  </label>
                  <input
                    type="text"
                    value={customGenericName}
                    onChange={(e) => onChange({ customGenericName: e.target.value })}
                    placeholder="ex: amoxicilline"
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-300">
                  ⚠️ Saisie libre : aucune vérification ATC automatique. Vérifiez manuellement les allergies.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------- ÉTAPE 2 : Alertes de sécurité ---------- */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                Vérification de sécurité
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Matching ATC strict contre les {patient.allergies.filter(a => a.status === 'active').length} allergie(s) active(s) du patient.
              </p>
            </div>

            {/* Médicament sélectionné */}
            <div className="p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <Pill className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {activeMed?.displayName}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    ATC : {activeMed?.atcCode || '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Résultats allergies */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Analyse allergologique
              </h4>
              {allergyResults.length === 0 && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="inline h-4 w-4 mr-1.5" />
                  Aucune allergie active enregistrée.
                </div>
              )}
              {allergyResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-3 border text-xs ${
                    result.matched && (result.matchType === 'exact_substance' || result.matchType === 'same_pharmacological_class')
                      ? result.matchedAllergy?.severity === 'critical' || result.matchedAllergy?.severity === 'life_threatening'
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {result.matched ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold">
                        {result.matched
                          ? `${result.matchType === 'exact_substance' ? 'Substance identique' : 'Classe pharmacologique partagée'} : ${result.matchedAllergy?.substanceDisplay}`
                          : 'Aucune réaction croisée détectée'}
                      </div>
                      <div className="mt-0.5 opacity-80">{result.safetyNote}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Validation */}
            <div className={`p-3 border text-xs ${
              canProceedStep2
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}>
              {canProceedStep2 ? (
                <>
                  <CheckCircle2 className="inline h-4 w-4 mr-1.5" />
                  Sécurité validée. Vous pouvez passer à la posologie.
                </>
              ) : (
                <>
                  <AlertTriangle className="inline h-4 w-4 mr-1.5" />
                  Allergie critique détectée. Prescription bloquée. Override requis via break-glass.
                </>
              )}
            </div>
          </div>
        )}

        {/* ---------- ÉTAPE 3 : Posologie + Signature ---------- */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                Posologie & signature
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Format 80mm POS pour impression ordonnance sécurisée.
              </p>
            </div>

            {/* Preview du médicament */}
            <div className="p-3 border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-xs">
              <div className="font-bold text-blue-900 dark:text-blue-100">{activeMed?.displayName}</div>
              <div className="text-blue-700 dark:text-blue-300 mt-0.5">
                ATC {activeMed?.atcCode} · {activeMed?.category}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Posologie *
                </label>
                <input
                  type="text"
                  value={dosage}
                  onChange={(e) => onChange({ dosage: e.target.value })}
                  placeholder="ex: 1 comprimé matin et soir"
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Fréquence *
                </label>
                <input
                  type="text"
                  value={frequency}
                  onChange={(e) => onChange({ frequency: e.target.value })}
                  placeholder="ex: 2 fois par jour"
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Durée (jours) *
                </label>
                <input
                  type="number"
                  value={durationDays}
                  min={1}
                  max={365}
                  onChange={(e) => onChange({ durationDays: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Voie *
                </label>
                <select
                  value={route}
                  onChange={(e) => onChange({ route: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">— Choisir —</option>
                  <option value="Orale">Orale</option>
                  <option value="Injectable">Injectable</option>
                  <option value="Inhalée">Inhalée</option>
                  <option value="Cutanée">Cutanée</option>
                  <option value="Sublinguale">Sublinguale</option>
                  <option value="Oculaire">Oculaire</option>
                  <option value="Rectale">Rectale</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Quantité à délivrer *
                </label>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => onChange({ quantity: e.target.value })}
                  placeholder="ex: 12 comprimés"
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isNarcotic}
                    onChange={(e) => onChange({ isNarcotic: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Stupéfiant (ordonnance sécurisée obligatoire)
                </label>
              </div>
              {isNarcotic && (
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-amber-700 dark:text-amber-300 mb-1 uppercase tracking-wider">
                    Motif prescription (requis pour stupéfiants) *
                  </label>
                  <textarea
                    value={prescriptionReason}
                    onChange={(e) => onChange({ prescriptionReason: e.target.value })}
                    placeholder="Indication clinique précise..."
                    rows={2}
                    className="w-full px-3 py-2 text-xs border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Signature */}
            <div className="p-3 border-t-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2 mb-2">
                <PenLine className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Signature électronique
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                En signant, vous confirmez que cette prescription est médicalement justifiée. La signature sera horodatée et journalisée dans l'audit trail (SHA-256 chaîné).
              </p>
              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-1.5">
                Prescripteur : {currentUser.displayName} · {new Date().toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ============== FOOTER : Navigation ============== */}
      <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Annuler
        </button>
        <div className="flex items-center gap-2">
          {currentStep > 1 && (
            <button
              onClick={handlePrev}
              className="flex items-center gap-1 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </button>
          )}
          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !canSubmit}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed shadow-sm transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signature en cours…
                </>
              ) : (
                <>
                  <PenLine className="h-4 w-4" />
                  Signer & Prescrire
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

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
  Edit3,
  Search,
  BookOpen,
  Sparkles,
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
  // Mode selection: 'catalog' or 'custom' (free-text entry)
  const [entryMode, setEntryMode] = useState<'catalog' | 'custom'>('catalog');

  // Catalog selection & search
  const [selectedMedId, setSelectedMedId] = useState<string>(catalog[0]?.id || '');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');

  // Free-text / custom product entry state
  const [customProductName, setCustomProductName] = useState<string>('');
  const [customGenericName, setCustomGenericName] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('Médicament sur ordonnance');

  // Posology & administration parameters
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

  // Filter catalog list based on search query
  const filteredCatalog = useMemo(() => {
    if (!catalogSearchQuery.trim()) return catalog;
    const q = catalogSearchQuery.toLowerCase().trim();
    return catalog.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }, [catalog, catalogSearchQuery]);

  // Derive active medication item (either from catalog or dynamically created for custom product)
  const activeMed: MedicationCatalogItem = useMemo(() => {
    if (entryMode === 'custom') {
      const name = customProductName.trim() || 'Médicament spécifique';
      const generic = customGenericName.trim() || name;

      // Smart detection of active substance keywords for safety check
      const detectedSubstances: string[] = [];
      const detectedAllergenClasses: string[] = [];
      const lower = (name + ' ' + generic).toLowerCase();

      if (lower.includes('amoxicilline') || lower.includes('amox') || lower.includes('augmentin') || lower.includes('clamoxyl')) {
        detectedSubstances.push('amoxicilline');
        detectedAllergenClasses.push('penicillin', 'beta_lactam');
      }
      if (lower.includes('acide clavulanique') || lower.includes('clavulanique') || lower.includes('augmentin')) {
        detectedSubstances.push('acide_clavulanique');
      }
      if (lower.includes('pénicilline') || lower.includes('penicilline')) {
        detectedAllergenClasses.push('penicillin', 'beta_lactam');
      }
      if (lower.includes('céphalosporine') || lower.includes('ceftriaxone') || lower.includes('cefixime')) {
        detectedAllergenClasses.push('cephalosporin', 'beta_lactam');
      }
      if (lower.includes('ibuprofène') || lower.includes('advil') || lower.includes('nurofen') || lower.includes('kétoprofène')) {
        detectedSubstances.push('ibuprofène');
        detectedAllergenClasses.push('nsaid');
      }
      if (lower.includes('aspirine') || lower.includes('kardegic') || lower.includes('acétylsalicylique')) {
        detectedSubstances.push('acide_acétylsalicylique');
        detectedAllergenClasses.push('nsaid', 'salicylate');
      }
      if (lower.includes('clarithromycine') || lower.includes('érythromycine') || lower.includes('azithromycine')) {
        detectedSubstances.push('clarithromycine');
        detectedAllergenClasses.push('macrolide');
      }

      return {
        id: `custom_${Date.now()}`,
        code: 'CUSTOM_ENTRY',
        displayName: name,
        genericName: generic,
        category: customCategory,
        form: 'Comprimé / Solution',
        strength: dosage || 'Dose usuelle',
        standardDose: dosage || '1 prise',
        standardFrequency: frequency || '2 fois par jour',
        standardDurationDays: durationDays || 7,
        routeOptions: ['Orale', 'Injectable', 'Inhalée', 'Cutanée', 'Sublinguale', 'Autre'],
        activeSubstances: detectedSubstances,
        allergenClasses: detectedAllergenClasses,
      };
    }

    return catalog.find((m) => m.id === selectedMedId) || catalog[0];
  }, [
    entryMode,
    customProductName,
    customGenericName,
    customCategory,
    dosage,
    frequency,
    durationDays,
    selectedMedId,
    catalog,
  ]);

  // Update default fields when catalog medication changes
  const handleCatalogMedChange = (medId: string) => {
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

  // Switch to custom free-text mode pre-filled with query
  const handleSwitchToCustomWithName = (name: string) => {
    setEntryMode('custom');
    setCustomProductName(name);
    setOverrideChecked(false);
    setOverrideReason('');
    if (!dosage) setDosage('1 comprimé');
    if (!patientInstructions) {
      setPatientInstructions('Respecter strictement les horaires de prise prescrits.');
    }
  };

  // Initialize once for catalog product
  React.useEffect(() => {
    if (entryMode === 'catalog' && activeMed && !dosage) {
      setDosage(activeMed.standardDose);
      setFrequency(activeMed.standardFrequency);
      setDurationDays(activeMed.standardDurationDays);
      setRoute(activeMed.routeOptions[0] || 'Orale');
      setPatientInstructions('À prendre de préférence au cours du repas avec un grand verre d\'eau.');
    }
  }, [entryMode, activeMed, dosage]);

  // Live Safety Evaluation Engine
  const safetyEvaluation = useMemo(() => {
    if (!activeMed) return null;
    return evaluateMedicationSafety(patient, activeMed, activeMedications);
  }, [patient, activeMed, activeMedications]);

  if (!isOpen) return null;

  const hasCriticalFindings = safetyEvaluation?.findings.some((f) => f.severity === 'critical');

  const isProductValid =
    entryMode === 'catalog'
      ? Boolean(selectedMedId)
      : customProductName.trim().length >= 2;

  const canSign =
    isProductValid &&
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
      medicationId: activeMed.id,
      medicationDisplay: activeMed.displayName,
      genericName: activeMed.genericName,
      dosage,
      route,
      frequency,
      durationDays,
      quantity: `${durationDays * 2} unités`,
      refills: 0,
      patientInstructions: patientInstructions || 'Prendre selon la posologie indiquée.',
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
      <div className="my-8 w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl transition-colors">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/70 dark:bg-slate-800/50 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 shadow-xs">
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
            aria-label="Fermer la fenêtre de prescription"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer rounded-xl p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Mode Selector Tab: Catalogue vs Saisie Manuelle */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-1.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setEntryMode('catalog')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                entryMode === 'catalog'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Base & Catalogue Clinique</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEntryMode('custom');
                if (!customProductName && catalogSearchQuery) {
                  setCustomProductName(catalogSearchQuery);
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                entryMode === 'custom'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Edit3 className="h-4 w-4" />
              <span>Saisie Libre du Produit</span>
            </button>
          </div>

          {/* 1. Sélection ou Saisie Manuelle du Produit */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
            {entryMode === 'catalog' ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Sélectionner dans le catalogue clinique
                  </label>
                  <button
                    type="button"
                    onClick={() => setEntryMode('custom')}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Saisir un autre nom de produit</span>
                  </button>
                </div>

                {/* Instant Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={catalogSearchQuery}
                    onChange={(e) => setCatalogSearchQuery(e.target.value)}
                    placeholder="Filtrer ou rechercher par nom commercial, DCI ou classe..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 focus:outline-hidden"
                  />
                </div>

                {/* Dropdown Selector */}
                <select
                  aria-label="Sélectionner le médicament dans le catalogue"
                  value={selectedMedId}
                  onChange={(e) => handleCatalogMedChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-hidden"
                >
                  {filteredCatalog.length === 0 ? (
                    <option value="" disabled>
                      Aucun produit trouvé dans le catalogue pour cette recherche
                    </option>
                  ) : (
                    filteredCatalog.map((med) => (
                      <option key={med.id} value={med.id} className="dark:bg-slate-900 dark:text-slate-100">
                        {med.displayName} — {med.category} ({med.genericName})
                      </option>
                    ))
                  )}
                </select>

                {/* Option to switch to custom typing if product not in list */}
                {catalogSearchQuery.trim() && (
                  <div className="p-2.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-700 dark:text-slate-300">
                      Vous cherchez <strong>« {catalogSearchQuery} »</strong> ?
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSwitchToCustomWithName(catalogSearchQuery)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shrink-0 cursor-pointer"
                    >
                      Prescrire en saisie libre &rarr;
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Saisie Manuelle du Produit */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Edit3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span>Saisie directe du nom de produit ou spécialité</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEntryMode('catalog')}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Retour au catalogue &rarr;
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nom du produit / Spécialité commerciale *
                    </label>
                    <input
                      type="text"
                      value={customProductName}
                      onChange={(e) => setCustomProductName(e.target.value)}
                      placeholder="Ex: Doliprane 1000mg, Augmentin 1g/125mg, Kardegic 75mg, Inexium 20mg..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      DCI / Principe actif (recommandé pour contrôle des allergies)
                    </label>
                    <input
                      type="text"
                      value={customGenericName}
                      onChange={(e) => setCustomGenericName(e.target.value)}
                      placeholder="Ex: Paracétamol, Amoxicilline, Acide acétylsalicylique..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Catégorie thérapeutique
                    </label>
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-hidden"
                    >
                      <option value="Antalgique & Antipyrétique">Antalgique & Antipyrétique</option>
                      <option value="Antibiotique">Antibiotique</option>
                      <option value="Cardiologie & Vasculaire">Cardiologie & Vasculaire</option>
                      <option value="Anti-inflammatoire (AINS / Corticoïde)">Anti-inflammatoire</option>
                      <option value="Gastro-entérologie">Gastro-entérologie</option>
                      <option value="Pneumologie & Allergie">Pneumologie & Allergie</option>
                      <option value="Médicament sur ordonnance">Autre médicament sur ordonnance</option>
                    </select>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-start gap-2 text-[11px] text-blue-900 dark:text-blue-200">
                  <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    La détection automatique des substances actives et des classes allergéniques (pénicillines, AINS, macrolides) s'exécute en continu sur votre saisie pour préserver la sécurité clinique du patient.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Posologie, Fréquence, Voie et Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Posologie & Forme *
              </label>
              <input
                type="text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="Ex: 1 comprimé par prise"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fréquence des prises
              </label>
              <input
                type="text"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="Ex: 2 à 3 fois par jour si douleur"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-hidden"
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
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-hidden font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Voie d'administration
              </label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-hidden"
              >
                {activeMed.routeOptions.map((r) => (
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
                placeholder="Ex: Douleur articulaire / Céphalée / Épisode infectieux ORL"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-hidden"
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
                placeholder="Ex: À prendre au cours du repas avec un grand verre d'eau. Espacer les prises d'au moins 6 heures."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* 3. Alertes du Moteur de Sécurité Clinique */}
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
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/40 p-4 flex items-center gap-3 text-emerald-900 dark:text-emerald-200">
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

                      {/* Technical evidence accordion */}
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

            {/* Mandatory Override Section if critical findings */}
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
                      className="w-full rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/40 p-2 text-xs text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-hidden"
                    />
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      Ce motif sera scellé avec votre identifiant RPPS dans le journal d'audit immuable.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Checklist de validation progressive */}
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
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/70 dark:bg-slate-800/50 rounded-b-3xl">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {entryMode === 'custom' && !customProductName.trim() && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                Saisissez le nom du produit à prescrire.
              </span>
            )}
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

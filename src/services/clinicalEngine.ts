import {
  MedicationCatalogItem,
  MedicationOrder,
  Patient,
  RuleFinding,
  DecisionResult,
  Appointment,
  UserRole,
} from '../types/clinical';

export const ENGINE_VERSION = '2026.09.1';
export const KNOWLEDGE_VERSION = 'catalog-fr-2026-09';

/**
 * Moteur de règles médicamenteuses et interactions déterministe
 */
export function evaluateMedicationSafety(
  patient: Patient,
  proposedMedication: MedicationCatalogItem,
  activeMedications: MedicationOrder[]
): DecisionResult {
  const findings: RuleFinding[] = [];
  const evaluatedAt = new Date().toISOString();

  // 1. Contrôle des allergies connues (Priorité critique)
  const patientActiveAllergies = patient.allergies.filter((a) => a.status === 'active');
  for (const allergy of patientActiveAllergies) {
    const allergyCode = allergy.substanceCode.toLowerCase();
    const allergyDisplay = allergy.substanceDisplay.toLowerCase();

    // Vérification des correspondances de substances ou de classes allergéniques
    // NOTE : pour la rétro-compatibilité, on accepte l'ancien champ allergenClasses (display-based)
    // mais on privilégie allergenClassCodes (ATC-based, strict) via allergyMatchingService.
    const legacyClasses = proposedMedication.allergenClasses ?? [];
    const matchesAllergenClass = legacyClasses.some(
      (c) => allergyCode.includes(c) || allergyDisplay.includes(c)
    );
    const matchesSubstance = proposedMedication.activeSubstances.some(
      (s) => allergyCode.includes(s) || allergyDisplay.includes(s)
    );

    if (matchesAllergenClass || matchesSubstance) {
      findings.push({
        ruleId: `ALLERGY_${proposedMedication.code.toUpperCase()}_001`,
        code: 'ALLERGY_MATCH',
        severity: 'critical',
        title: `Allergie avérée : ${allergy.substanceDisplay}`,
        message: `Le patient présente une allergie active enregistrée à "${allergy.substanceDisplay}" (réaction documentée : ${allergy.reaction || 'Non précisée'}, sévérité : ${allergy.severity}). Ce médicament appartient à la classe ou contient le principe actif concerné.`,
        evidence: [
          `Allergie patient : ${allergy.substanceDisplay} (enregistrée le ${new Date(allergy.recordedAt).toLocaleDateString('fr-FR')})`,
          `Substances actives du produit : ${proposedMedication.activeSubstances.join(', ')}`,
          `Classes allergéniques : ${(proposedMedication.allergenClasses ?? []).join(', ')}`,
        ],
        action: 'block_unless_overridden',
        requiresOverride: true,
      });
    }
  }

  // 2. Contrôle des interactions médicamenteuses majeures (avec traitements actifs)
  for (const activeOrder of activeMedications) {
    const existingName = activeOrder.medicationDisplay.toLowerCase();
    const existingGeneric = activeOrder.genericName.toLowerCase();
    const proposedName = proposedMedication.displayName.toLowerCase();
    const proposedGeneric = proposedMedication.genericName.toLowerCase();

    // AINS + Anticoagulant (ex: Ibuprofène + Warfarine)
    if (
      (proposedGeneric.includes('ibuprofène') || proposedGeneric.includes('kétoprofène')) &&
      (existingGeneric.includes('warfarine') || existingGeneric.includes('anticoagulant') || existingName.includes('coumadine'))
    ) {
      findings.push({
        ruleId: 'DDI_NSAID_ANTICOAGULANT_001',
        code: 'DDI_BLEEDING_RISK',
        severity: 'major',
        title: 'Interaction majeure : AINS + Anticoagulant oral',
        message: `L'association d'un AINS (${proposedMedication.displayName}) avec un anticoagulant (${activeOrder.medicationDisplay}) majore considérablement le risque d'hémorragie digestive et systémique.`,
        evidence: [
          `Traitement actif en cours : ${activeOrder.medicationDisplay}`,
          `Médicament proposé : ${proposedMedication.displayName}`,
          `Mécanisme : inhibition plaquettaire et toxicité muqueuse gastrique`,
        ],
        action: 'review_required',
        requiresOverride: true,
      });
    }

    // Macrolide + Statine (ex: Clarithromycine + Atorvastatine)
    if (
      (proposedGeneric.includes('clarithromycine') || proposedGeneric.includes('érythromycine')) &&
      (existingGeneric.includes('atorvastatine') || existingGeneric.includes('simvastatine'))
    ) {
      findings.push({
        ruleId: 'DDI_MACROLIDE_STATIN_002',
        code: 'DDI_RHABDOMYOLYSIS',
        severity: 'major',
        title: 'Interaction majeure : Macrolide + Statine',
        message: `Inhibition puissante du CYP3A4 par le macrolide entraînant une augmentation toxique des concentrations sériques de la statine avec risque de rhabdomyolyse.`,
        evidence: [
          `Traitement actif en cours : ${activeOrder.medicationDisplay}`,
          `Médicament proposé : ${proposedMedication.displayName}`,
          `Recommandation : suspendre temporairement la statine ou changer d'antibiotique`,
        ],
        action: 'review_required',
        requiresOverride: true,
      });
    }

    // Doublon thérapeutique direct
    if (
      proposedMedication.activeSubstances.some((sub) =>
        existingGeneric.includes(sub)
      ) ||
      existingName.includes(proposedGeneric)
    ) {
      findings.push({
        ruleId: 'DUP_THERAPEUTIC_003',
        code: 'THERAPEUTIC_DUPLICATION',
        severity: 'moderate',
        title: 'Doublon thérapeutique potentiel',
        message: `Le patient dispose déjà d'une prescription active de substance identique ou proche (${activeOrder.medicationDisplay}). Vérifiez qu'il ne s'agit pas d'une surdose non intentionnelle.`,
        evidence: [
          `Prescription active : ${activeOrder.medicationDisplay} (${activeOrder.dosage})`,
          `Prescription candidate : ${proposedMedication.displayName}`,
        ],
        action: 'review_required',
        requiresOverride: false,
      });
    }
  }

  // 3. Contrôle des antécédents et facteurs de risque du patient
  const hasAsthma = patient.problems.some((p) => p.display.toLowerCase().includes('asthme'));
  if (hasAsthma && (proposedMedication.genericName.toLowerCase().includes('ibuprofène') || proposedMedication.genericName.toLowerCase().includes('aspirine'))) {
    findings.push({
      ruleId: 'CI_ASTHMA_NSAID_004',
      code: 'CONTRAINDICATION_ASTHMA',
      severity: 'moderate',
      title: 'Précaution d\'emploi : Asthme et AINS',
      message: 'Le patient est suivi pour un asthme. Risque potentiel de bronchospasme induit par les AINS (syndrome de Widal).',
      evidence: [`Antécédent : Asthme actif documenté dans le dossier`],
      action: 'inform',
      requiresOverride: false,
    });
  }

  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasMajor = findings.some((f) => f.severity === 'major');

  const status: 'allowed' | 'warning' | 'blocked' = hasCritical
    ? 'blocked'
    : hasMajor
    ? 'warning'
    : 'allowed';

  return {
    decisionId: `dec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    engineVersion: ENGINE_VERSION,
    knowledgeVersion: KNOWLEDGE_VERSION,
    evaluatedAt,
    findings,
    status,
  };
}

/**
 * Détection de conflit de créneaux d'agenda pour un praticien
 */
export interface ScheduleConflictResult {
  hasConflict: boolean;
  conflictingAppointment?: Appointment;
  suggestedSlots: Array<{ startsAt: string; endsAt: string; label: string }>;
}

export function checkAppointmentConflict(
  practitionerId: string,
  startsAtIso: string,
  endsAtIso: string,
  existingAppointments: Appointment[],
  excludeAppointmentId?: string
): ScheduleConflictResult {
  const reqStart = new Date(startsAtIso).getTime();
  const reqEnd = new Date(endsAtIso).getTime();

  const practitionerAppts = existingAppointments.filter(
    (a) =>
      a.practitionerId === practitionerId &&
      a.status !== 'cancelled' &&
      a.id !== excludeAppointmentId
  );

  let conflictingAppointment: Appointment | undefined;

  for (const appt of practitionerAppts) {
    const apptStart = new Date(appt.startsAt).getTime();
    const apptEnd = new Date(appt.endsAt).getTime();

    // Chevauchement : (reqStart < apptEnd) && (reqEnd > apptStart)
    if (reqStart < apptEnd && reqEnd > apptStart) {
      conflictingAppointment = appt;
      break;
    }
  }

  if (!conflictingAppointment) {
    return { hasConflict: false, suggestedSlots: [] };
  }

  // Calcul de suggestions alternatives intelligentes (ex: après le conflit, ou 1h plus tard)
  const durationMs = reqEnd - reqStart;
  const conflictEnd = new Date(conflictingAppointment.endsAt).getTime();
  
  const suggestedSlots: Array<{ startsAt: string; endsAt: string; label: string }> = [];

  // Suggestion 1 : juste après la fin du rendez-vous en conflit
  const slot1Start = new Date(conflictEnd + 10 * 60 * 1000); // +10min battement
  const slot1End = new Date(slot1Start.getTime() + durationMs);
  suggestedSlots.push({
    startsAt: slot1Start.toISOString(),
    endsAt: slot1End.toISOString(),
    label: `Aujourd'hui à ${formatTime(slot1Start)} – ${formatTime(slot1End)}`,
  });

  // Suggestion 2 : 1 heure après le créneau demandé
  const slot2Start = new Date(reqStart + 60 * 60 * 1000);
  const slot2End = new Date(slot2Start.getTime() + durationMs);
  suggestedSlots.push({
    startsAt: slot2Start.toISOString(),
    endsAt: slot2End.toISOString(),
    label: `Aujourd'hui à ${formatTime(slot2Start)} – ${formatTime(slot2End)}`,
  });

  // Suggestion 3 : Lendemain matin 09:30
  const tomorrow = new Date(reqStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 30, 0, 0);
  const slot3End = new Date(tomorrow.getTime() + durationMs);
  suggestedSlots.push({
    startsAt: tomorrow.toISOString(),
    endsAt: slot3End.toISOString(),
    label: `Demain à ${formatTime(tomorrow)} – ${formatTime(slot3End)}`,
  });

  return {
    hasConflict: true,
    conflictingAppointment,
    suggestedSlots,
  };
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Matrice d'habilitations RBAC & ABAC contextuelle
 */
export function evaluateUserPermissions(role: UserRole, isBreakGlassActive = false) {
  // Règle RGPD / CNIL : l'accueil ne doit jamais avoir accès aux notes, diagnostics ou prescriptions
  const canViewClinical =
    isBreakGlassActive || role === 'doctor' || role === 'nurse' || role === 'auditor';
  const canEditClinical = isBreakGlassActive || role === 'doctor' || role === 'nurse';
  const canPrescribe = role === 'doctor'; // Seul le médecin peut prescrire
  const canManageSchedule = role === 'doctor' || role === 'receptionist' || role === 'nurse';
  const canViewAudit = role === 'auditor' || role === 'security_admin';
  const canManageSecurity = role === 'security_admin';
  const canBreakGlass = role === 'doctor' || role === 'nurse';

  return {
    canViewClinical,
    canEditClinical,
    canPrescribe,
    canManageSchedule,
    canViewAudit,
    canManageSecurity,
    canBreakGlass,
  };
}

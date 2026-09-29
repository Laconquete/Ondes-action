import { Patient, VitalSignSet } from '../types/clinical';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertCategory =
  | 'blood_pressure'
  | 'pulse'
  | 'oxygen_saturation'
  | 'temperature'
  | 'respiratory_rate'
  | 'bmi';

export interface ClinicalVitalAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  badgeLabel: string;
  title: string;
  message: string;
  valueDisplay: string;
  normalRange: string;
  recommendation: string;
  detectedAt: string;
}

/**
 * Moteur d'Alertes Cliniques en Temps Réel
 * Basé sur les recommandations HAS (Haute Autorité de Santé) et SFHTA (Société Française d'Hypertension)
 */
export function analyzeVitalSet(vitals: VitalSignSet): ClinicalVitalAlert[] {
  const alerts: ClinicalVitalAlert[] = [];
  const now = vitals.measuredAt || new Date().toISOString();

  // 1. Tension Artérielle (Systolique & Diastolique)
  if (vitals.systolic != null && vitals.diastolic != null) {
    const sys = vitals.systolic;
    const dia = vitals.diastolic;

    if (sys >= 180 || dia >= 120) {
      alerts.push({
        id: `alert_bp_crit_${vitals.id}`,
        category: 'blood_pressure',
        severity: 'critical',
        badgeLabel: 'Crise Hypertensive',
        title: 'Urgence Hypertensive (≥ 180/120 mmHg)',
        message: `Tension artérielle critique à ${sys}/${dia} mmHg. Risque immédiat de décompensation viscérale.`,
        valueDisplay: `${sys}/${dia} mmHg`,
        normalRange: '< 140/90 mmHg',
        recommendation: 'Repos 15 min en décubitus, contrôle immédiat, recherche de céphalées/flou visuel, avis SAMU/Cardiologie.',
        detectedAt: now,
      });
    } else if (sys >= 140 || dia >= 90) {
      alerts.push({
        id: `alert_bp_high_${vitals.id}`,
        category: 'blood_pressure',
        severity: 'warning',
        badgeLabel: 'HTA Stade 2',
        title: 'Hypertension Artérielle Élevée',
        message: `Pression artérielle non contrôlée (${sys}/${dia} mmHg). Seuil de sécurité clinique dépassé.`,
        valueDisplay: `${sys}/${dia} mmHg`,
        normalRange: '< 140/90 mmHg',
        recommendation: 'Vérifier l\'observance thérapeutique, envisager intensification du traitement ou MAPA de contrôle.',
        detectedAt: now,
      });
    } else if (sys >= 135 || dia >= 85) {
      alerts.push({
        id: `alert_bp_lim_${vitals.id}`,
        category: 'blood_pressure',
        severity: 'info',
        badgeLabel: 'TA Normale Haute',
        title: 'Tension Limite Supérieure',
        message: `Pression artérielle à surveiller (${sys}/${dia} mmHg).`,
        valueDisplay: `${sys}/${dia} mmHg`,
        normalRange: '< 130/80 mmHg',
        recommendation: 'Surveillance tensionnelle rapprochée et conseils hygiéno-diététiques.',
        detectedAt: now,
      });
    } else if ((sys > 0 && sys < 90) || (dia > 0 && dia < 60)) {
      alerts.push({
        id: `alert_bp_low_${vitals.id}`,
        category: 'blood_pressure',
        severity: 'warning',
        badgeLabel: 'Hypotension',
        title: 'Hypotension Artérielle',
        message: `Tension artérielle basse (${sys}/${dia} mmHg). Risque de lipothymie ou chute.`,
        valueDisplay: `${sys}/${dia} mmHg`,
        normalRange: '≥ 90/60 mmHg',
        recommendation: 'Rechercher une déshydratation, un surdosage médicamenteux ou une hypotension orthostatique.',
        detectedAt: now,
      });
    }
  }

  // 2. Fréquence Cardiaque (Pouls)
  if (vitals.pulseBpm != null && vitals.pulseBpm > 0) {
    const pulse = vitals.pulseBpm;
    if (pulse >= 120) {
      alerts.push({
        id: `alert_pulse_crit_${vitals.id}`,
        category: 'pulse',
        severity: 'critical',
        badgeLabel: 'Tachycardie Sévère',
        title: `Tachycardie Majeure (${pulse} bpm)`,
        message: `Fréquence cardiaque très élevée à ${pulse} bpm au repos.`,
        valueDisplay: `${pulse} bpm`,
        normalRange: '55 - 90 bpm',
        recommendation: 'Réaliser un ECG 12 dérivations en urgence, vérifier SpO2, éliminer flutter/FA rapide ou sepsis.',
        detectedAt: now,
      });
    } else if (pulse > 100) {
      alerts.push({
        id: `alert_pulse_high_${vitals.id}`,
        category: 'pulse',
        severity: 'warning',
        badgeLabel: 'Tachycardie',
        title: `Tachycardie de Repos (${pulse} bpm)`,
        message: `Fréquence cardiaque supérieure aux seuils physiologiques habituels (${pulse} bpm).`,
        valueDisplay: `${pulse} bpm`,
        normalRange: '55 - 90 bpm',
        recommendation: 'Auscultation cardio-pulmonaire, recherche de fièvre, anxiété, anémie ou décompensation.',
        detectedAt: now,
      });
    } else if (pulse < 45) {
      alerts.push({
        id: `alert_pulse_critlow_${vitals.id}`,
        category: 'pulse',
        severity: 'critical',
        badgeLabel: 'Bradycardie Sévère',
        title: `Bradycardie Critique (${pulse} bpm)`,
        message: `Rythme cardiaque très ralenti à ${pulse} bpm. Risque de bas débit cérébral.`,
        valueDisplay: `${pulse} bpm`,
        normalRange: '≥ 50 bpm',
        recommendation: 'Recherche de BAV (bloc auriculo-ventriculaire) à l\'ECG, arrêt temporaire des bêtabloquants.',
        detectedAt: now,
      });
    } else if (pulse < 50) {
      alerts.push({
        id: `alert_pulse_low_${vitals.id}`,
        category: 'pulse',
        severity: 'warning',
        badgeLabel: 'Bradycardie',
        title: `Bradycardie Sinusale (${pulse} bpm)`,
        message: `Fréquence cardiaque basse à ${pulse} bpm.`,
        valueDisplay: `${pulse} bpm`,
        normalRange: '50 - 90 bpm',
        recommendation: 'Vérifier la tolérance hémodynamique et les traitements bradycardisants.',
        detectedAt: now,
      });
    }
  }

  // 3. Saturation en Oxygène (SpO2)
  if (vitals.oxygenSaturation != null && vitals.oxygenSaturation > 0) {
    const spo2 = vitals.oxygenSaturation;
    if (spo2 < 90) {
      alerts.push({
        id: `alert_spo2_crit_${vitals.id}`,
        category: 'oxygen_saturation',
        severity: 'critical',
        badgeLabel: 'Hypoxie Sévère',
        title: `Désaturation Critique (${spo2}%)`,
        message: `Saturation pulsée en oxygène dangereusement basse (${spo2}%).`,
        valueDisplay: `${spo2}%`,
        normalRange: '≥ 95%',
        recommendation: 'Mise sous oxygène immédiate, auscultation pulmonaire, bilan gazométrie/radio thorax en urgence.',
        detectedAt: now,
      });
    } else if (spo2 < 95) {
      alerts.push({
        id: `alert_spo2_warn_${vitals.id}`,
        category: 'oxygen_saturation',
        severity: 'warning',
        badgeLabel: 'Désaturation',
        title: `SpO2 Limite / Basse (${spo2}%)`,
        message: `Saturation en oxygène suboptimale (${spo2}%).`,
        valueDisplay: `${spo2}%`,
        normalRange: '95 - 100%',
        recommendation: 'Évaluer la détresse respiratoire, rechercher un bronchospasme ou un encombrement bronchique.',
        detectedAt: now,
      });
    }
  }

  // 4. Température Corporelle
  if (vitals.temperatureC != null && vitals.temperatureC > 0) {
    const temp = vitals.temperatureC;
    if (temp >= 39.5) {
      alerts.push({
        id: `alert_temp_crit_${vitals.id}`,
        category: 'temperature',
        severity: 'critical',
        badgeLabel: 'Hyperthermie Majeure',
        title: `Fièvre Élevée (${temp}°C)`,
        message: `Hyperthermie sévère à ${temp}°C.`,
        valueDisplay: `${temp}°C`,
        normalRange: '36.5 - 37.5°C',
        recommendation: 'Bilan infectieux immédiat, antipyrétique, recherche de signes de gravité septique.',
        detectedAt: now,
      });
    } else if (temp >= 38.3) {
      alerts.push({
        id: `alert_temp_warn_${vitals.id}`,
        category: 'temperature',
        severity: 'warning',
        badgeLabel: 'Fièvre Aiguë',
        title: `Hyperthermie (${temp}°C)`,
        message: `État fébrile constaté (${temp}°C).`,
        valueDisplay: `${temp}°C`,
        normalRange: '36.5 - 37.5°C',
        recommendation: 'Rechercher le foyer infectieux (pulmonaire, urinaire, ORL), prescrire antipyrétique.',
        detectedAt: now,
      });
    } else if (temp < 35.5) {
      alerts.push({
        id: `alert_temp_low_${vitals.id}`,
        category: 'temperature',
        severity: 'warning',
        badgeLabel: 'Hypothermie',
        title: `Hypothermie (${temp}°C)`,
        message: `Température corporelle anormalement basse (${temp}°C).`,
        valueDisplay: `${temp}°C`,
        normalRange: '≥ 36.0°C',
        recommendation: 'Réchauffement progressif, contrôle glycémique et hémodynamique.',
        detectedAt: now,
      });
    }
  }

  // 5. Indice de Masse Corporelle (IMC)
  if (vitals.bmi != null && vitals.bmi > 0) {
    const bmi = vitals.bmi;
    if (bmi >= 35) {
      alerts.push({
        id: `alert_bmi_ob_${vitals.id}`,
        category: 'bmi',
        severity: 'info',
        badgeLabel: 'Obésité Sévère',
        title: `Obésité de Classe 2 (IMC ${bmi})`,
        message: `Indice de masse corporelle élevé (IMC ${bmi} kg/m²). Facteur de risque cardiovasculaire.`,
        valueDisplay: `IMC ${bmi}`,
        normalRange: '18.5 - 24.9',
        recommendation: 'Dépistage du syndrome métabolique et apnées du sommeil, accompagnement diététique.',
        detectedAt: now,
      });
    } else if (bmi < 18.5) {
      alerts.push({
        id: `alert_bmi_under_${vitals.id}`,
        category: 'bmi',
        severity: 'warning',
        badgeLabel: 'Dénutrition',
        title: `Insuffisance Pondérale (IMC ${bmi})`,
        message: `Poids insuffisant par rapport à la taille (IMC ${bmi} kg/m²).`,
        valueDisplay: `IMC ${bmi}`,
        normalRange: '18.5 - 24.9',
        recommendation: 'Dépistage de dénutrition protéino-énergétique, bilan biologique nutritionnel.',
        detectedAt: now,
      });
    }
  }

  return alerts;
}

/**
 * Récupère le dernier jeu de constantes mesuré pour un patient
 */
export function getPatientLatestVitals(patient: Patient): VitalSignSet | undefined {
  if (!patient.vitalsHistory || patient.vitalsHistory.length === 0) return undefined;
  return [...patient.vitalsHistory].sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
  )[0];
}

/**
 * Analyse les constantes d'un patient et retourne ses alertes cliniques actives
 */
export function analyzePatientVitals(patient: Patient): ClinicalVitalAlert[] {
  const latest = getPatientLatestVitals(patient);
  if (!latest) return [];
  return analyzeVitalSet(latest);
}

/**
 * Calcule le niveau global de gravité des alertes d'un patient
 */
export function getPatientAlertLevel(
  alerts: ClinicalVitalAlert[]
): 'critical' | 'warning' | 'info' | 'normal' {
  if (alerts.some((a) => a.severity === 'critical')) return 'critical';
  if (alerts.some((a) => a.severity === 'warning')) return 'warning';
  if (alerts.some((a) => a.severity === 'info')) return 'info';
  return 'normal';
}

/**
 * Extrait toutes les alertes actives pour une liste de patients
 */
export function getCabinetVitalAlertsSummary(patients: Patient[]): {
  totalAlerts: number;
  criticalCount: number;
  warningCount: number;
  patientsWithAlerts: { patient: Patient; alerts: ClinicalVitalAlert[]; level: 'critical' | 'warning' | 'info' }[];
} {
  const patientsWithAlerts: {
    patient: Patient;
    alerts: ClinicalVitalAlert[];
    level: 'critical' | 'warning' | 'info';
  }[] = [];

  let totalAlerts = 0;
  let criticalCount = 0;
  let warningCount = 0;

  for (const patient of patients) {
    const alerts = analyzePatientVitals(patient);
    if (alerts.length > 0) {
      const level = getPatientAlertLevel(alerts);
      if (level !== 'normal') {
        patientsWithAlerts.push({ patient, alerts, level });
        totalAlerts += alerts.length;
        criticalCount += alerts.filter((a) => a.severity === 'critical').length;
        warningCount += alerts.filter((a) => a.severity === 'warning').length;
      }
    }
  }

  return {
    totalAlerts,
    criticalCount,
    warningCount,
    patientsWithAlerts,
  };
}

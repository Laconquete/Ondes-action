/**
 * Types partagés internes au module PatientVitalsTrends.
 * Permet aux sous-composants d'échanger des données typées sans dépendre du composant shell.
 */

import type { Patient, VitalSignSet } from '../../types/clinical';

export type MetricView = 'bp_weight' | 'bp' | 'weight' | 'heartRate' | 'all';
export type TimeRange = 'all' | '1year' | '6months' | '3months';

export interface PatientVitalsTrendsProps {
  patient: Patient;
  onAddVitalsClick?: () => void;
  compact?: boolean;
  defaultTimeRange?: TimeRange;
  defaultMetricView?: MetricView;
  hideHeaderCard?: boolean;
}

/**
 * Statut clinique d'une mesure de tension artérielle.
 * Utilisé par le tooltip, les KPI cards et les badges.
 */
export interface BpStatus {
  label: string;
  color: string; // classes tailwind pour le texte
  bg: string; // classes tailwind pour le fond
  dot: string; // classe tailwind pour le point
}

/**
 * Étend VitalSignSet avec des champs calculés pour le rendu Recharts.
 * Note : `shortDateLabel` et `fullDateLabel` sont optionnels car le chartData
 * du composant shell les ajoute dynamiquement lors de la construction.
 * `pulsePressure` peut être null quand systolic ou diastolic est manquant.
 */
export interface ChartDataPoint extends VitalSignSet {
  fullDateLabel?: string;
  shortDateLabel?: string;
  pulsePressure: number | null;
  measuredBy: string;
}

/**
 * Résumé statistique d'une série de mesures.
 */
export interface VitalsSummary {
  latestSys: number | null;
  latestDia: number | null;
  latestPulse: number | null;
  latestWeight: number | null;
  latestBmi: number | null;
  latestSpo2: number | null;
  latestTemp: number | null;
  trendSys: 'up' | 'down' | 'stable';
  trendDia: 'up' | 'down' | 'stable';
  trendPulse: 'up' | 'down' | 'stable';
  trendWeight: 'up' | 'down' | 'stable';
  totalMeasurements: number;
}

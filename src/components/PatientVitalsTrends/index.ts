/**
 * Barrel export du module PatientVitalsTrends.
 *
 * L'import `../components/PatientVitalsTrends` résout automatiquement vers ce fichier
 * (Node/Bun/Vite resolution), donc les consommateurs (DoctorWorkspace.tsx,
 * PatientListAndDetail.tsx) n'ont aucune ligne à modifier.
 *
 * API publique inchangée :
 *  - <PatientVitalsTrends /> (composant principal)
 *  - type MetricView
 *  - type TimeRange
 *  - type PatientVitalsTrendsProps (préserver pour compat)
 */

// Le composant shell reste dans le fichier parent PatientVitalsTrends.tsx pour préserver
// l'arborescence historique. On le ré-exporte depuis ici pour exposer l'API publique.
export { PatientVitalsTrends } from '../PatientVitalsTrends';
export type { MetricView, TimeRange, PatientVitalsTrendsProps } from './types';

// Sous-composants atomiques (réutilisables individuellement si besoin futur)
export { VitalsTooltip } from './VitalsTooltip';
export { VitalsEmptyState } from './VitalsEmptyState';
export { FiltersBar } from './FiltersBar';
export { KpiCards } from './KpiCards';
export { MetricSwitcher } from './MetricSwitcher';
export { VitalsTable } from './VitalsTable';
export { getBpStatus, getPulseStatus, getBmiStatus } from './clinicalStatus';
export { exportVitalsCsv } from './exportVitalsCsv';

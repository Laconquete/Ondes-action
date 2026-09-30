import type { ChartDataPoint } from './types';
import type { Patient } from '../../types/clinical';

/**
 * Export CSV des constantes vitales d'un patient.
 *
 * Format : en-tête FR + données tabulaires. Encodage UTF-8 pour Excel/LibreOffice.
 * Le fichier est nommé : constantes_{NOM}_{IPP}.csv
 *
 * Extrait du composant original sans modification de comportement.
 */
export function exportVitalsCsv(chartData: ChartDataPoint[], patient: Patient): void {
  if (chartData.length === 0) return;

  const headers = [
    'Date',
    'Heure',
    'Systolique (mmHg)',
    'Diastolique (mmHg)',
    'Pouls (bpm)',
    'Poids (kg)',
    'Taille (cm)',
    'IMC',
    'Température (°C)',
    'SpO2 (%)',
    'Professionnel',
  ];
  const rows = chartData.map((d) => [
    new Date(d.measuredAt).toLocaleDateString('fr-FR'),
    new Date(d.measuredAt).toLocaleTimeString('fr-FR'),
    d.systolic || '',
    d.diastolic || '',
    d.pulseBpm || '',
    d.weightKg || '',
    d.heightCm || '',
    d.bmi || '',
    d.temperatureC || '',
    d.oxygenSaturation || '',
    `"${d.measuredBy}"`,
  ]);
  const csvContent =
    'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    `constantes_${patient.familyName}_${patient.medicalRecordNumber}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

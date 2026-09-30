import React from 'react';
import {
  Activity,
  Download,
  Eye,
  Info,
  Plus,
} from 'lucide-react';
import type { TimeRange } from './types';

interface FiltersBarProps {
  timeRange: TimeRange;
  highContrast: boolean;
  showThresholds: boolean;
  measurementsCount: number | undefined;
  onTimeRangeChange: (range: TimeRange) => void;
  onToggleHighContrast: () => void;
  onToggleShowThresholds: () => void;
  onExportCsv: () => void;
  onAddVitalsClick?: () => void;
  hideHeaderCard?: boolean;
}

/**
 * Barre d'outils supérieure du composant PatientVitalsTrends.
 *
 * Contient :
 *  - Titre "Évolution des Signes Vitaux" + badge Recharts + compteur de mesures
 *  - Sélecteur de période (6 mois / 3 mois / 1 an / Tout)
 *  - Toggle Contraste Fort (lisibilité clinique renforcée, WCAG AAA)
 *  - Toggle Cibles HTA (lignes de référence HAS)
 *  - Bouton Export CSV
 *  - Bouton "+ Mesure" (si onAddVitalsClick fourni)
 *
 * Extrait du composant original (lignes ~250-374) sans modification visuelle.
 */
export const FiltersBar: React.FC<FiltersBarProps> = ({
  timeRange,
  highContrast,
  showThresholds,
  measurementsCount,
  onTimeRangeChange,
  onToggleHighContrast,
  onToggleShowThresholds,
  onExportCsv,
  onAddVitalsClick,
  hideHeaderCard,
}) => {
  if (hideHeaderCard) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-slate-200/90 dark:border-slate-800 shadow-clinical transition-colors">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <span>Évolution des Signes Vitaux (Tension, Poids)</span>
              <span className="rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold">
                Recharts
              </span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {timeRange === '6months' ? 'Sur les 6 derniers mois' : 'Période personnalisée'} · {measurementsCount ?? 0} point(s) de mesure analysé(s)
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2">
        {/* Time range selector */}
        <div className="inline-flex border border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800 p-0.5 text-xs">
          {(['6months', '3months', '1year', 'all'] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => onTimeRangeChange(range)}
              className={`px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                timeRange === range
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
              title={
                range === '6months'
                  ? 'Afficher l évolution sur les 6 derniers mois (recommandé)'
                  : undefined
              }
            >
              {range === '6months' ? '6 mois' : range === '3months' ? '3 mois' : range === '1year' ? '1 an' : 'Tout'}
            </button>
          ))}
        </div>

        {/* High Contrast Toggle */}
        <button
          type="button"
          onClick={onToggleHighContrast}
          className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-bold transition-all shadow-2xs cursor-pointer ${
            highContrast
              ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
          title="Activer/Désactiver le mode haute lisibilité et contraste clinique renforcé"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>{highContrast ? 'Contraste Fort (Actif)' : 'Contraste Standard'}</span>
        </button>

        {/* Toggle Thresholds */}
        <button
          type="button"
          onClick={onToggleShowThresholds}
          className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
            showThresholds
              ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Info className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Cibles HTA</span>
        </button>

        {/* Export CSV */}
        <button
          type="button"
          onClick={onExportCsv}
          title="Exporter les données en CSV"
          className="inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-slate-500" />
          <span className="hidden sm:inline">CSV</span>
        </button>

        {onAddVitalsClick && (
          <button
            type="button"
            onClick={onAddVitalsClick}
            className="inline-flex items-center gap-1 bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Mesure</span>
          </button>
        )}
      </div>
    </div>
  );
};

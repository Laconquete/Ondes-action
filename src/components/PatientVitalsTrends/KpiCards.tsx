import React from 'react';
import { Activity, Heart, Scale } from 'lucide-react';
import type { TimeRange } from './types';
import type { BpStatus } from './types';

interface VitalsStats {
  latest: {
    systolic?: number | null;
    diastolic?: number | null;
    pulseBpm?: number | null;
    weightKg?: number | null;
    bmi?: number | null;
    pulsePressure?: number | null;
  };
  avgSys?: number | null;
  avgDia?: number | null;
  avgPulse?: number | null;
  minPulse?: number | null;
  maxPulse?: number | null;
  weightDelta?: number | null;
  count?: number | null;
}

interface KpiCardsProps {
  // `stats` peut être null (en cours de calcul) ou undefined (pas encore calculé)
  stats: VitalsStats | null | undefined;
  timeRange: TimeRange;
  metricView: string;
  latestBpStatus: BpStatus;
  latestPulseStatus: BpStatus;
  latestBmiStatus: { label: string; color: string; bg: string };
  onSelectMetric: (view: 'bp' | 'weight' | 'heartRate') => void;
}

/**
 * 3 cartes statistiques cliquables :
 *  - Carte 1 : Pression Artérielle (TA) avec moyenne et pression pulsée
 *  - Carte 2 : Poids & IMC avec delta de poids sur la période
 *  - Carte 3 : Fréquence Cardiaque avec moyenne et plage min/max
 *
 * Chaque carte met à jour la vue du graphique au clic.
 *
 * Extrait du composant original (lignes ~376-547) sans modification visuelle.
 */
export const KpiCards: React.FC<KpiCardsProps> = ({
  stats,
  timeRange,
  metricView,
  latestBpStatus,
  latestPulseStatus,
  latestBmiStatus,
  onSelectMetric,
}) => {
  const periodLabel = timeRange === '6months' ? '6 mois' : 'période';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      {/* Card 1 : Tension Artérielle */}
      <div
        onClick={() => onSelectMetric('bp')}
        className={`cursor-pointer border p-4 transition-all shadow-clinical ${
          metricView === 'bp'
            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center bg-blue-600 text-white font-bold">
              <Activity className="h-3.5 w-3.5" />
            </span>
            Pression Artérielle (TA)
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${latestBpStatus.color} ${latestBpStatus.bg}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${latestBpStatus.dot}`} />
            {latestBpStatus.label}
          </span>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <span className="font-mono text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight tabular-nums">
              {stats?.latest.systolic}/{stats?.latest.diastolic}
            </span>
            <span className="ml-1 text-xs text-slate-600 dark:text-slate-300 font-mono font-bold">
              mmHg
            </span>
          </div>
          {stats?.avgSys && stats?.avgDia && (
            <div className="text-right">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                Moyenne {periodLabel}
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {stats.avgSys}/{stats.avgDia} mmHg
              </span>
            </div>
          )}
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <span>Pression pulsée : <strong className="text-slate-900 dark:text-slate-100 font-bold">{stats?.latest.pulsePressure || '—'} mmHg</strong></span>
          <span className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
            Courbe &rarr;
          </span>
        </div>
      </div>

      {/* Card 2 : Poids & IMC */}
      <div
        onClick={() => onSelectMetric('weight')}
        className={`cursor-pointer border p-4 transition-all shadow-clinical ${
          metricView === 'weight'
            ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center bg-emerald-600 text-white font-bold">
              <Scale className="h-3.5 w-3.5" />
            </span>
            Poids & Indice Corporel (IMC)
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${latestBmiStatus.color} ${latestBmiStatus.bg}`}
          >
            IMC {stats?.latest.bmi || '—'}
          </span>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <span className="font-mono text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight tabular-nums">
              {stats?.latest.weightKg || '—'}
            </span>
            <span className="ml-1 text-xs text-slate-600 dark:text-slate-300 font-mono font-bold">
              kg
            </span>
          </div>
          {stats && stats.weightDelta !== null && stats.weightDelta !== undefined && (
            <div
              className={`flex items-center gap-1 text-xs font-mono font-extrabold px-2.5 py-1 ${
                stats.weightDelta > 0
                  ? 'text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700'
                  : stats.weightDelta < 0
                  ? 'text-emerald-950 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700'
                  : 'text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700'
              }`}
            >
              {stats.weightDelta > 0 ? '+' : ''}
              {stats.weightDelta.toFixed(1)} kg
            </div>
          )}
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <span>Évolution {periodLabel}</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
            Courbe &rarr;
          </span>
        </div>
      </div>

      {/* Card 3 : Pouls (Fréquence Cardiaque) */}
      <div
        onClick={() => onSelectMetric('heartRate')}
        className={`cursor-pointer border p-4 transition-all shadow-clinical ${
          metricView === 'heartRate'
            ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/40 ring-2 ring-rose-500/20'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center bg-rose-600 text-white font-bold">
              <Heart className="h-3.5 w-3.5" />
            </span>
            Fréquence Cardiaque
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${latestPulseStatus.color} ${latestPulseStatus.bg}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${latestPulseStatus.dot}`} />
            {latestPulseStatus.label}
          </span>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <span className="font-mono text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight tabular-nums">
              {stats?.latest.pulseBpm || '—'}
            </span>
            <span className="ml-1 text-xs text-slate-600 dark:text-slate-300 font-mono font-bold">
              bpm
            </span>
          </div>
          {stats?.avgPulse && (
            <div className="text-right">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                Moyenne {periodLabel}
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {stats.avgPulse} bpm
              </span>
            </div>
          )}
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <span>Plage : <strong className="text-slate-900 dark:text-slate-100 font-bold">{stats?.minPulse} - {stats?.maxPulse} bpm</strong></span>
          <span className="text-rose-600 dark:text-rose-400 font-bold hover:underline">
            Courbe &rarr;
          </span>
        </div>
      </div>
    </div>
  );
};

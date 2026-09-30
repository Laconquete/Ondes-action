import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import {
  Activity,
  Heart,
  Scale,
  Thermometer,
  Wind,
  TrendingDown,
  TrendingUp,
  Minus,
  Calendar,
  Filter,
  Plus,
  Info,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Download,
  Share2,
  Printer,
  Sparkles,
  Eye,
  Maximize2,
  ChevronDown,
} from 'lucide-react';
import { Patient, VitalSignSet } from '../types/clinical';
import { useTheme } from '../context/ThemeContext';
// Sous-composants extraits (refactor — non-régression : API publique inchangée)
import { VitalsTooltip } from './PatientVitalsTrends/VitalsTooltip';
import { VitalsEmptyState } from './PatientVitalsTrends/VitalsEmptyState';
import { getBpStatus, getPulseStatus, getBmiStatus } from './PatientVitalsTrends/clinicalStatus';
import { exportVitalsCsv } from './PatientVitalsTrends/exportVitalsCsv';

export type MetricView = 'bp_weight' | 'bp' | 'weight' | 'heartRate' | 'all';
export type TimeRange = 'all' | '1year' | '6months' | '3months';

interface PatientVitalsTrendsProps {
  patient: Patient;
  onAddVitalsClick?: () => void;
  compact?: boolean;
  defaultTimeRange?: TimeRange;
  defaultMetricView?: MetricView;
  hideHeaderCard?: boolean;
}

export const PatientVitalsTrends: React.FC<PatientVitalsTrendsProps> = ({
  patient,
  onAddVitalsClick,
  compact = false,
  defaultTimeRange = '6months',
  defaultMetricView = 'bp_weight',
  hideHeaderCard = false,
}) => {
  const { isDark } = useTheme();
  const [metricView, setMetricView] = useState<MetricView>(defaultMetricView);
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange);
  const [showThresholds, setShowThresholds] = useState<boolean>(true);
  // High contrast mode enabled by default to ensure optimal clinical readability
  const [highContrast, setHighContrast] = useState<boolean>(true);
  const [showFullTable, setShowFullTable] = useState<boolean>(!compact);

  // Dynamic colors for Recharts with enhanced contrast ratios (WCAG AAA compliant)
  const chartTheme = useMemo(() => {
    if (highContrast) {
      return {
        // High Contrast Clinical Palette: deep contrasting strokes and sharp grids
        grid: isDark ? '#334155' : '#cbd5e1', // Slate-700 / Slate-300
        gridSubtle: isDark ? '#1e293b' : '#e2e8f0',
        axis: isDark ? '#94a3b8' : '#1e293b',
        tick: isDark ? '#f8fafc' : '#0f172a', // Maximum legibility on both backgrounds
        tickBp: isDark ? '#93c5fd' : '#1e40af', // Blue-300 / Blue-800
        tickWeight: isDark ? '#6ee7b7' : '#065f46', // Emerald-300 / Emerald-800
        tickBmi: isDark ? '#d8b4fe' : '#5b21b6', // Purple-300 / Purple-800
        lineSys: isDark ? '#60a5fa' : '#1d4ed8', // Bright blue / Deep royal blue
        lineDia: isDark ? '#2dd4bf' : '#0f766e', // Bright teal / Deep teal
        lineWeight: isDark ? '#34d399' : '#047857', // Bright emerald / Deep emerald
        linePulse: isDark ? '#fb7185' : '#be123c', // Bright rose / Deep rose
        lineBmi: isDark ? '#c084fc' : '#6d28d9', // Bright violet / Deep violet
        refLineHta: isDark ? '#f87171' : '#b91c1c', // High contrast red
        refLineWarning: isDark ? '#fbbf24' : '#b45309', // High contrast amber
        refLineInfo: isDark ? '#818cf8' : '#4338ca',
        refAreaNormo: isDark ? '#059669' : '#10b981',
        tooltipBg: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
        tooltipBorder: isDark ? '#475569' : '#94a3b8',
      };
    }

    return {
      // Standard Palette
      grid: isDark ? '#1e293b' : '#e2e8f0',
      gridSubtle: isDark ? '#0f172a' : '#f1f5f9',
      axis: isDark ? '#475569' : '#cbd5e1',
      tick: isDark ? '#cbd5e1' : '#334155',
      tickBp: isDark ? '#60a5fa' : '#2563eb',
      tickWeight: isDark ? '#34d399' : '#0d9488',
      tickBmi: isDark ? '#c084fc' : '#7c3aed',
      lineSys: isDark ? '#3b82f6' : '#2563eb',
      lineDia: isDark ? '#14b8a6' : '#0d9488',
      lineWeight: isDark ? '#10b981' : '#059669',
      linePulse: isDark ? '#f43f5e' : '#e11d48',
      lineBmi: isDark ? '#a855f7' : '#8b5cf6',
      refLineHta: isDark ? '#f87171' : '#dc2626',
      refLineWarning: isDark ? '#fbbf24' : '#d97706',
      refLineInfo: isDark ? '#818cf8' : '#4f46e5',
      refAreaNormo: isDark ? '#059669' : '#10b981',
      tooltipBg: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.96)',
      tooltipBorder: isDark ? '#334155' : '#cbd5e1',
    };
  }, [isDark, highContrast]);

  // Chronologically sorted and filtered data relative to the latest available measurement
  const chartData = useMemo(() => {
    if (!patient.vitalsHistory || patient.vitalsHistory.length === 0) return [];

    const sorted = [...patient.vitalsHistory].sort(
      (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
    );

    // Compute reference point from either latest recorded measurement or today
    const latestRecordedTime = new Date(sorted[sorted.length - 1].measuredAt).getTime();
    const nowTime = new Date().getTime();
    const referenceTime = Math.max(latestRecordedTime, nowTime);

    const filtered = sorted.filter((v) => {
      const date = new Date(v.measuredAt).getTime();
      if (timeRange === '3months') return referenceTime - date <= 93 * 24 * 3600 * 1000;
      if (timeRange === '6months') return referenceTime - date <= 186 * 24 * 3600 * 1000;
      if (timeRange === '1year') return referenceTime - date <= 366 * 24 * 3600 * 1000;
      return true;
    });

    return filtered.map((item) => {
      const d = new Date(item.measuredAt);
      const formattedDate = d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      });
      const formattedFullDate = d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      const pulsePressure =
        item.systolic && item.diastolic ? item.systolic - item.diastolic : null;

      return {
        ...item,
        rawTimestamp: d.getTime(),
        dateLabel: formattedDate,
        fullDateLabel: `${formattedFullDate} à ${time}`,
        pulsePressure,
      };
    });
  }, [patient.vitalsHistory, timeRange]);

  // Summary statistics computed over the current filtered window
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;

    const latest = chartData[chartData.length - 1];
    const previous = chartData.length > 1 ? chartData[chartData.length - 2] : null;

    // Blood Pressure Averages
    const validBp = chartData.filter((d) => d.systolic && d.diastolic);
    const avgSys = validBp.length
      ? Math.round(validBp.reduce((acc, curr) => acc + (curr.systolic || 0), 0) / validBp.length)
      : null;
    const avgDia = validBp.length
      ? Math.round(validBp.reduce((acc, curr) => acc + (curr.diastolic || 0), 0) / validBp.length)
      : null;

    // Pulse Averages
    const validPulse = chartData.filter((d) => d.pulseBpm);
    const avgPulse = validPulse.length
      ? Math.round(validPulse.reduce((acc, curr) => acc + (curr.pulseBpm || 0), 0) / validPulse.length)
      : null;
    const minPulse = validPulse.length ? Math.min(...validPulse.map((d) => d.pulseBpm!)) : null;
    const maxPulse = validPulse.length ? Math.max(...validPulse.map((d) => d.pulseBpm!)) : null;

    // Weight delta
    const validWeight = chartData.filter((d) => d.weightKg);
    const firstWeight = validWeight.length ? validWeight[0].weightKg : null;
    const lastWeight = validWeight.length ? validWeight[validWeight.length - 1].weightKg : null;
    const weightDelta =
      firstWeight && lastWeight ? +(lastWeight - firstWeight).toFixed(1) : null;
    const avgWeight = validWeight.length
      ? +(validWeight.reduce((acc, curr) => acc + (curr.weightKg || 0), 0) / validWeight.length).toFixed(1)
      : null;

    return {
      latest,
      previous,
      avgSys,
      avgDia,
      avgPulse,
      minPulse,
      maxPulse,
      avgWeight,
      weightDelta,
      count: chartData.length,
    };
  }, [chartData]);

  // Clinical evaluation helpers
  // Les fonctions getBpStatus, getPulseStatus, getBmiStatus sont maintenant importées
  // depuis ./PatientVitalsTrends/clinicalStatus (extraction pour réduire la taille du composant).
  // Réexportées ici pour préserver l'API interne (utilisées plus bas dans le rendu).
  // (alias locaux pour minimiser les modifications du corps du composant)
  const handleExportCsv = () => exportVitalsCsv(chartData, patient);

  // Le tooltip custom est désormais <VitalsTooltip /> (importé).
  // On garde un alias local pour minimiser les modifications dans les props Recharts.
  const CustomTooltip = VitalsTooltip;

  if (chartData.length === 0) {
    return (
      <VitalsEmptyState
        timeRange={timeRange}
        onShowAllHistory={() => setTimeRange('all')}
        onAddVitalsClick={onAddVitalsClick}
      />
    );
  }

  const latestBpStatus = getBpStatus(stats?.latest.systolic, stats?.latest.diastolic);
  const latestPulseStatus = getPulseStatus(stats?.latest.pulseBpm);
  const latestBmiStatus = getBmiStatus(stats?.latest.bmi);

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar with Filter & Contrast Switch */}
      {!hideHeaderCard && (
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
                  {timeRange === '6months' ? 'Sur les 6 derniers mois' : 'Période personnalisée'} · {stats?.count} point(s) de mesure analysé(s)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Time range selector with 6-month highlight */}
            <div className="inline-flex border border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTimeRange('6months')}
                className={` px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  timeRange === '6months'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
                title="Afficher l'évolution sur les 6 derniers mois (recommandé)"
              >
                6 mois
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('3months')}
                className={` px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  timeRange === '3months'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                3 mois
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('1year')}
                className={` px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  timeRange === '1year'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                1 an
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('all')}
                className={` px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  timeRange === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                Tout
              </button>
            </div>

            {/* High Contrast Mode Toggle Button */}
            <button
              type="button"
              onClick={() => setHighContrast(!highContrast)}
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
              onClick={() => setShowThresholds(!showThresholds)}
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
              onClick={handleExportCsv}
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
      )}

      {/* 2. Key Metrics Snapshot Cards (Tension & Poids Prominently Featured) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* Card 1 : Tension Artérielle */}
        <div
          onClick={() => setMetricView('bp')}
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
                  Moyenne {timeRange === '6months' ? '6 mois' : 'période'}
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

        {/* Card 2 : Poids & Évolution Pondérale */}
        <div
          onClick={() => setMetricView('weight')}
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
                    : 'text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {stats.weightDelta > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : stats.weightDelta < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                <span>
                  {stats.weightDelta > 0 ? `+${stats.weightDelta}` : stats.weightDelta} kg sur 6 mois
                </span>
              </div>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
            <span>Taille : <strong className="text-slate-900 dark:text-slate-100 font-bold">{stats?.latest.heightCm} cm</strong></span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
              Courbe &rarr;
            </span>
          </div>
        </div>

        {/* Card 3 : Pouls (Fréquence Cardiaque) */}
        <div
          onClick={() => setMetricView('heartRate')}
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
                  Moyenne {timeRange === '6months' ? '6 mois' : 'période'}
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

      {/* 3. Metric Switcher Segmented Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setMetricView('bp_weight')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
            metricView === 'bp_weight'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Tension & Poids (Vue Recommandée 6 mois)</span>
        </button>

        <button
          type="button"
          onClick={() => setMetricView('bp')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
            metricView === 'bp'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Tension Artérielle seule</span>
        </button>

        <button
          type="button"
          onClick={() => setMetricView('weight')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
            metricView === 'weight'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>Poids & IMC seul</span>
        </button>

        <button
          type="button"
          onClick={() => setMetricView('heartRate')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
            metricView === 'heartRate'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Heart className="h-4 w-4" />
          <span>Fréquence Cardiaque</span>
        </button>

        <button
          type="button"
          onClick={() => setMetricView('all')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
            metricView === 'all'
              ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-md shadow-slate-900/20'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Vue Panoramique Complète</span>
        </button>
      </div>

      {/* 4. Main Chart Canvas Card with High Contrast */}
      <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-clinical transition-colors">
        {/* VIEW 0: TENSION & POIDS COMBINÉS (DUAL-AXIS LINE CHART) */}
        {metricView === 'bp_weight' && (
          <div>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  Corrélation Tension (mmHg) & Poids (kg) au cours des 6 derniers mois
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Axe gauche : Pression Artérielle Systolique/Diastolique · Axe droit : Poids corporel
                </p>
              </div>

              {/* Legend Badges with High Contrast */}
              <div className="flex items-center flex-wrap gap-2 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-blue-900 dark:text-blue-200 bg-blue-100 dark:bg-blue-950 px-2.5 py-1 border border-blue-300 dark:border-blue-700">
                  <span className="h-3 w-3 rounded-full bg-blue-600" />
                  Systolique (G)
                </span>
                <span className="flex items-center gap-1.5 text-teal-900 dark:text-teal-200 bg-teal-100 dark:bg-teal-950 px-2.5 py-1 border border-teal-300 dark:border-teal-700">
                  <span className="h-3 w-3 rounded-full bg-teal-600" />
                  Diastolique (G)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 border border-emerald-300 dark:border-emerald-700">
                  <span className="h-3 w-3 bg-emerald-600" />
                  Poids kg (D)
                </span>
              </div>
            </div>

            <div className={compact ? 'h-72 w-full' : 'h-88 w-full'}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: chartTheme.tick, fontWeight: 700 }}
                    axisLine={{ stroke: chartTheme.axis, strokeWidth: highContrast ? 2 : 1 }}
                    tickLine={false}
                  />
                  {/* Left Y-Axis: Blood Pressure in mmHg */}
                  <YAxis
                    yAxisId="bp"
                    domain={[50, 180]}
                    ticks={[60, 80, 100, 120, 140, 160]}
                    tick={{ fontSize: 11, fill: chartTheme.tickBp, fontWeight: 700 }}
                    axisLine={{ stroke: chartTheme.axis, strokeWidth: highContrast ? 2 : 1 }}
                    tickLine={false}
                    unit=" mmHg"
                  />
                  {/* Right Y-Axis: Weight in kg */}
                  <YAxis
                    yAxisId="weight"
                    orientation="right"
                    domain={['dataMin - 3', 'dataMax + 3']}
                    tick={{ fontSize: 11, fill: chartTheme.tickWeight, fontWeight: 700 }}
                    axisLine={{ stroke: chartTheme.axis, strokeWidth: highContrast ? 2 : 1 }}
                    tickLine={false}
                    unit=" kg"
                  />
                  <Tooltip content={<CustomTooltip />} />

                  {showThresholds && (
                    <>
                      {/* Hypertension Stage 1 Threshold on BP axis */}
                      <ReferenceLine
                        yAxisId="bp"
                        y={140}
                        stroke={chartTheme.refLineHta}
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        label={{
                          value: 'Seuil HTA (140 mmHg)',
                          fill: chartTheme.refLineHta,
                          fontSize: 11,
                          fontWeight: 800,
                          position: 'top',
                        }}
                      />
                      <ReferenceLine
                        yAxisId="bp"
                        y={90}
                        stroke={chartTheme.refLineWarning}
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: 'Seuil HTA Dia (90 mmHg)',
                          fill: chartTheme.refLineWarning,
                          fontSize: 10,
                          fontWeight: 700,
                          position: 'top',
                        }}
                      />
                    </>
                  )}

                  {/* Systolic Line */}
                  <Line
                    yAxisId="bp"
                    type="monotone"
                    dataKey="systolic"
                    name="Systolique"
                    stroke={chartTheme.lineSys}
                    strokeWidth={highContrast ? 3.5 : 2.5}
                    dot={{ r: 5, stroke: chartTheme.lineSys, strokeWidth: 2, fill: '#ffffff' }}
                    activeDot={{ r: 8, stroke: '#1e3a8a', strokeWidth: 3, fill: '#ffffff' }}
                  />

                  {/* Diastolic Line */}
                  <Line
                    yAxisId="bp"
                    type="monotone"
                    dataKey="diastolic"
                    name="Diastolique"
                    stroke={chartTheme.lineDia}
                    strokeWidth={highContrast ? 3.5 : 2.5}
                    dot={{ r: 5, stroke: chartTheme.lineDia, strokeWidth: 2, fill: '#ffffff' }}
                    activeDot={{ r: 8, stroke: '#115e59', strokeWidth: 3, fill: '#ffffff' }}
                  />

                  {/* Weight Line on Right Axis */}
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weightKg"
                    name="Poids (kg)"
                    stroke={chartTheme.lineWeight}
                    strokeWidth={highContrast ? 3.5 : 2.5}
                    strokeDasharray={highContrast ? undefined : '5 5'}
                    dot={{ r: 5, stroke: chartTheme.lineWeight, strokeWidth: 2, fill: '#ffffff' }}
                    activeDot={{ r: 8, stroke: '#065f46', strokeWidth: 3, fill: '#ffffff' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 1: BLOOD PRESSURE DETAILED */}
        {metricView === 'bp' && (
          <div>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  Courbe Évolutive de la Pression Artérielle (mmHg)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Lignes directrices SFHTA : Cible optimale &lt; 130/80 mmHg · Seuil d'hypertension ≥ 140/90 mmHg
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-blue-900 dark:text-blue-200 bg-blue-100 dark:bg-blue-950 px-2.5 py-1 border border-blue-300 dark:border-blue-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  Systolique
                </span>
                <span className="flex items-center gap-1.5 text-teal-900 dark:text-teal-200 bg-teal-100 dark:bg-teal-950 px-2.5 py-1 border border-teal-300 dark:border-teal-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-600" />
                  Diastolique
                </span>
              </div>
            </div>

            <div className={compact ? 'h-72 w-full' : 'h-88 w-full'}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="sysGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartTheme.lineSys} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chartTheme.lineSys} stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="diaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartTheme.lineDia} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chartTheme.lineDia} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: chartTheme.tick, fontWeight: 700 }}
                    axisLine={{ stroke: chartTheme.axis, strokeWidth: highContrast ? 2 : 1 }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[50, 180]}
                    ticks={[60, 80, 90, 110, 120, 140, 160]}
                    tick={{ fontSize: 11, fill: chartTheme.tick, fontWeight: 700 }}
                    axisLine={{ stroke: chartTheme.axis, strokeWidth: highContrast ? 2 : 1 }}
                    tickLine={false}
                    unit=" mmHg"
                  />
                  <Tooltip content={<CustomTooltip />} />

                  {showThresholds && (
                    <>
                      <ReferenceLine
                        y={140}
                        stroke={chartTheme.refLineHta}
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        label={{
                          value: 'Seuil HTA Sys (140)',
                          fill: chartTheme.refLineHta,
                          fontSize: 11,
                          fontWeight: 800,
                          position: 'top',
                        }}
                      />
                      <ReferenceLine
                        y={90}
                        stroke={chartTheme.refLineWarning}
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: 'Seuil HTA Dia (90)',
                          fill: chartTheme.refLineWarning,
                          fontSize: 10,
                          fontWeight: 700,
                          position: 'top',
                        }}
                      />
                      <ReferenceArea
                        y1={60}
                        y2={80}
                        fill={chartTheme.refAreaNormo}
                        fillOpacity={isDark ? 0.15 : 0.08}
                      />
                      <ReferenceArea
                        y1={110}
                        y2={130}
                        fill="#3b82f6"
                        fillOpacity={isDark ? 0.15 : 0.08}
                      />
                    </>
                  )}

                  <Area
                    type="monotone"
                    dataKey="systolic"
                    name="Systolique"
                    fill="url(#sysGradient)"
                    stroke={chartTheme.lineSys}
                    strokeWidth={highContrast ? 3.5 : 2.5}
                    activeDot={{ r: 8, stroke: '#1d4ed8', strokeWidth: 3, fill: '#ffffff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="diastolic"
                    name="Diastolique"
                    fill="url(#diaGradient)"
                    stroke={chartTheme.lineDia}
                    strokeWidth={highContrast ? 3.5 : 2.5}
                    activeDot={{ r: 8, stroke: '#0f766e', strokeWidth: 3, fill: '#ffffff' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 2: HEART RATE DETAILED */}
        {metricView === 'heartRate' && (
          <div>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                  Courbe de la Fréquence Cardiaque de Repos (bpm)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Intervalle physiologique de repos : 60 à 100 battements/minute (Régulier)
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-rose-900 dark:text-rose-200 bg-rose-100 dark:bg-rose-950 px-2.5 py-1 border border-rose-300 dark:border-rose-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                  Pouls (bpm)
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-mono">
                  Moyenne : <strong className="text-slate-950 dark:text-white font-extrabold">{stats?.avgPulse} bpm</strong>
                </span>
              </div>
            </div>

            <div className={compact ? 'h-72 w-full' : 'h-88 w-full'}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="heartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartTheme.linePulse} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chartTheme.linePulse} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: chartTheme.tick, fontWeight: 700 }}
                    axisLine={{ stroke: chartTheme.axis, strokeWidth: highContrast ? 2 : 1 }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[45, 120]}
                    ticks={[50, 60, 70, 80, 90, 100, 110]}
                    tick={{ fontSize: 11, fill: chartTheme.tick, fontWeight: 700 }}
                    axisLine={{ stroke: chartTheme.axis, strokeWidth: highContrast ? 2 : 1 }}
                    tickLine={false}
                    unit=" bpm"
                  />
                  <Tooltip content={<CustomTooltip />} />

                  {showThresholds && (
                    <>
                      <ReferenceArea
                        y1={60}
                        y2={100}
                        fill={chartTheme.refAreaNormo}
                        fillOpacity={isDark ? 0.15 : 0.08}
                      />
                      <ReferenceLine
                        y={100}
                        stroke={chartTheme.refLineWarning}
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{
                          value: 'Tachycardie (>100)',
                          fill: chartTheme.refLineWarning,
                          fontSize: 10,
                          fontWeight: 700,
                          position: 'top',
                        }}
                      />
                      <ReferenceLine
                        y={60}
                        stroke={chartTheme.refLineInfo}
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{
                          value: 'Bradycardie (<60)',
                          fill: chartTheme.refLineInfo,
                          fontSize: 10,
                          fontWeight: 700,
                          position: 'bottom',
                        }}
                      />
                    </>
                  )}

                  <Area
                    type="monotone"
                    dataKey="pulseBpm"
                    name="Pouls"
                    stroke={chartTheme.linePulse}
                    strokeWidth={highContrast ? 3.5 : 2.5}
                    fillOpacity={1}
                    fill="url(#heartGradient)"
                    activeDot={{ r: 8, stroke: '#be123c', strokeWidth: 3, fill: '#ffffff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 3: WEIGHT & BMI DETAILED */}
        {metricView === 'weight' && (
          <div>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  Courbe Pondérale & Évolution de l'IMC (6 mois)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Variation totale :{' '}
                  <strong className="font-mono text-slate-950 dark:text-white font-extrabold tabular-nums">
                    {stats?.weightDelta && stats.weightDelta > 0
                      ? `+${stats.weightDelta}`
                      : stats?.weightDelta}{' '}
                    kg
                  </strong>{' '}
                  sur la période
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 border border-emerald-300 dark:border-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  Poids (kg - axe G)
                </span>
                <span className="flex items-center gap-1.5 text-purple-900 dark:text-purple-200 bg-purple-100 dark:bg-purple-950 px-2.5 py-1 border border-purple-300 dark:border-purple-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
                  IMC (kg/m² - axe D)
                </span>
              </div>
            </div>

            <div className={compact ? 'h-72 w-full' : 'h-88 w-full'}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartTheme.lineWeight} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chartTheme.lineWeight} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: chartTheme.tick, fontWeight: 700 }}
                    axisLine={{ stroke: chartTheme.axis, strokeWidth: highContrast ? 2 : 1 }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="weight"
                    domain={['dataMin - 3', 'dataMax + 3']}
                    tick={{ fontSize: 11, fill: chartTheme.tickWeight, fontWeight: 700 }}
                    axisLine={{ stroke: chartTheme.axis, strokeWidth: highContrast ? 2 : 1 }}
                    tickLine={false}
                    unit=" kg"
                  />
                  <YAxis
                    yAxisId="bmi"
                    orientation="right"
                    domain={[16, 35]}
                    ticks={[18.5, 25, 30]}
                    tick={{ fontSize: 11, fill: chartTheme.tickBmi, fontWeight: 700 }}
                    axisLine={{ stroke: chartTheme.axis, strokeWidth: highContrast ? 2 : 1 }}
                    tickLine={false}
                    unit=" IMC"
                  />
                  <Tooltip content={<CustomTooltip />} />

                  {showThresholds && (
                    <ReferenceArea
                      yAxisId="bmi"
                      y1={18.5}
                      y2={25}
                      fill={chartTheme.refAreaNormo}
                      fillOpacity={isDark ? 0.15 : 0.08}
                    />
                  )}

                  <Area
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weightKg"
                    name="Poids (kg)"
                    fill="url(#weightGrad)"
                    stroke={chartTheme.lineWeight}
                    strokeWidth={highContrast ? 3.5 : 2.5}
                    activeDot={{ r: 8, stroke: '#065f46', strokeWidth: 3, fill: '#ffffff' }}
                  />
                  <Line
                    yAxisId="bmi"
                    type="monotone"
                    dataKey="bmi"
                    name="IMC"
                    stroke={chartTheme.lineBmi}
                    strokeWidth={highContrast ? 3 : 2}
                    strokeDasharray="4 4"
                    dot={{ r: 5, stroke: chartTheme.lineBmi, strokeWidth: 2, fill: '#ffffff' }}
                    activeDot={{ r: 8, fill: chartTheme.lineBmi }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 4: MULTI-METRIC PANORAMIC */}
        {metricView === 'all' && (
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-blue-600" />
                  1. Profil Tensionnel (Systole / Diastole)
                </h4>
                <span className="text-xs text-slate-700 dark:text-slate-300 font-mono font-bold tabular-nums">
                  Dernier : {stats?.latest.systolic}/{stats?.latest.diastolic} mmHg
                </span>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: chartTheme.tick, fontWeight: 700 }} tickLine={false} />
                    <YAxis domain={[60, 170]} tick={{ fontSize: 10, fill: chartTheme.tick, fontWeight: 700 }} tickLine={false} unit=" mmHg" />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={140} stroke={chartTheme.refLineHta} strokeDasharray="3 3" strokeWidth={1.5} />
                    <Line type="monotone" dataKey="systolic" stroke={chartTheme.lineSys} strokeWidth={highContrast ? 3 : 2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="diastolic" stroke={chartTheme.lineDia} strokeWidth={highContrast ? 3 : 2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Heart className="h-4 w-4 text-rose-600" />
                    2. Fréquence Cardiaque (Pouls)
                  </h4>
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-mono font-extrabold tabular-nums">
                    {stats?.latest.pulseBpm} bpm
                  </span>
                </div>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: chartTheme.tick, fontWeight: 700 }} tickLine={false} />
                      <YAxis domain={[50, 110]} tick={{ fontSize: 10, fill: chartTheme.tick, fontWeight: 700 }} tickLine={false} unit=" bpm" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="pulseBpm" stroke={chartTheme.linePulse} fill={isDark ? '#4c0519' : '#ffe4e6'} strokeWidth={highContrast ? 3 : 2} dot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-emerald-600" />
                    3. Suivi Pondéral (kg)
                  </h4>
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-mono font-extrabold tabular-nums">
                    {stats?.latest.weightKg} kg (IMC {stats?.latest.bmi})
                  </span>
                </div>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: chartTheme.tick, fontWeight: 700 }} tickLine={false} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: chartTheme.tick, fontWeight: 700 }} tickLine={false} unit=" kg" />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="weightKg" stroke={chartTheme.lineWeight} strokeWidth={highContrast ? 3 : 2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Historical Data Table Toggle & Content */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-clinical overflow-hidden transition-colors">
        <button
          type="button"
          onClick={() => setShowFullTable(!showFullTable)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-700 dark:text-slate-300" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Journal Détaillé des Mesures ({chartData.length})
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
            <span>{showFullTable ? 'Masquer le tableau' : 'Afficher les valeurs numériques'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showFullTable ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {showFullTable && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 dark:bg-slate-800 text-xs font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Date & Heure</th>
                  <th className="px-4 py-3">Pression Artérielle</th>
                  <th className="px-4 py-3">Pouls</th>
                  <th className="px-4 py-3">Poids & IMC</th>
                  <th className="px-4 py-3">Température</th>
                  <th className="px-4 py-3">SpO₂</th>
                  <th className="px-4 py-3">Praticien</th>
                  <th className="px-4 py-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                {[...chartData].reverse().map((item, idx) => {
                  const bpStatus = getBpStatus(item.systolic, item.diastolic);
                  return (
                    <tr
                      key={item.id || idx}
                      className="hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {item.fullDateLabel}
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">
                        <span
                          className={`font-extrabold text-sm tabular-nums ${
                            item.systolic && item.systolic >= 140
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-slate-950 dark:text-white'
                          }`}
                        >
                          {item.systolic}/{item.diastolic}
                        </span>{' '}
                        <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                          mmHg
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">
                        <span
                          className={`font-extrabold tabular-nums ${
                            item.pulseBpm && (item.pulseBpm > 100 || item.pulseBpm < 60)
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {item.pulseBpm || '—'}
                        </span>{' '}
                        <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                          bpm
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">
                        <span className="font-extrabold text-slate-950 dark:text-white tabular-nums">
                          {item.weightKg || '—'} kg
                        </span>
                        {item.bmi && (
                          <span className="ml-1 text-xs text-slate-600 dark:text-slate-300 font-bold tabular-nums">
                            (IMC {item.bmi})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap tabular-nums font-semibold">
                        {item.temperatureC ? `${item.temperatureC}°C` : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap tabular-nums font-semibold">
                        {item.oxygenSaturation ? `${item.oxygenSaturation}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium">
                        {item.measuredBy}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${bpStatus.color} ${bpStatus.bg}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${bpStatus.dot}`} />
                          {bpStatus.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

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
} from 'lucide-react';
import { Patient, VitalSignSet } from '../types/clinical';
import { useTheme } from '../context/ThemeContext';

interface PatientVitalsTrendsProps {
  patient: Patient;
  onAddVitalsClick?: () => void;
}

type MetricView = 'bp' | 'heartRate' | 'weight' | 'all';
type TimeRange = 'all' | '1year' | '6months' | '3months';

export const PatientVitalsTrends: React.FC<PatientVitalsTrendsProps> = ({
  patient,
  onAddVitalsClick,
}) => {
  const { isDark } = useTheme();
  const [metricView, setMetricView] = useState<MetricView>('bp');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [showThresholds, setShowThresholds] = useState<boolean>(true);

  // Dynamic colors for Recharts based on clinical theme
  const chartTheme = useMemo(() => {
    return {
      grid: isDark ? '#1e293b' : '#f1f5f9',
      gridSubtle: isDark ? '#0f172a' : '#f8fafc',
      axis: isDark ? '#334155' : '#e2e8f0',
      tick: isDark ? '#94a3b8' : '#64748b',
      refLineHta: isDark ? '#f87171' : '#ef4444',
      refLineWarning: isDark ? '#fbbf24' : '#f59e0b',
      refLineInfo: isDark ? '#818cf8' : '#6366f1',
      refAreaNormo: isDark ? '#059669' : '#10b981',
      tooltipBg: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.96)',
      tooltipBorder: isDark ? '#334155' : '#e2e8f0',
    };
  }, [isDark]);

  // Chronologically sorted and filtered data
  const chartData = useMemo(() => {
    if (!patient.vitalsHistory || patient.vitalsHistory.length === 0) return [];

    const sorted = [...patient.vitalsHistory].sort(
      (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
    );

    const now = new Date('2026-09-28T22:47:48Z').getTime();

    const filtered = sorted.filter((v) => {
      const date = new Date(v.measuredAt).getTime();
      if (timeRange === '3months') return now - date <= 92 * 24 * 3600 * 1000;
      if (timeRange === '6months') return now - date <= 183 * 24 * 3600 * 1000;
      if (timeRange === '1year') return now - date <= 366 * 24 * 3600 * 1000;
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

  // Summary statistics
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

    return {
      latest,
      previous,
      avgSys,
      avgDia,
      avgPulse,
      minPulse,
      maxPulse,
      weightDelta,
      count: chartData.length,
    };
  }, [chartData]);

  // Clinical evaluation helpers
  const getBpStatus = (sys?: number, dia?: number) => {
    if (!sys || !dia) return { label: 'Non mesuré', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', dot: 'bg-slate-400' };
    if (sys >= 140 || dia >= 90) {
      return { label: 'HTA Stade 1', color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' };
    }
    if (sys >= 130 || dia >= 85) {
      return { label: 'Normale haute', color: 'text-blue-800 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800', dot: 'bg-blue-500' };
    }
    if (sys < 90 || dia < 60) {
      return { label: 'Hypotension', color: 'text-purple-800 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800', dot: 'bg-purple-500' };
    }
    return { label: 'Optimale', color: 'text-emerald-800 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' };
  };

  // Pulse status
  const getPulseStatus = (pulse?: number) => {
    if (!pulse) return { label: 'Non mesuré', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', dot: 'bg-slate-400' };
    if (pulse > 100) return { label: 'Tachycardie', color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' };
    if (pulse < 60) return { label: 'Bradycardie', color: 'text-indigo-800 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800', dot: 'bg-indigo-500' };
    return { label: 'Sinusal Régulier', color: 'text-emerald-800 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' };
  };

  // BMI status
  const getBmiStatus = (bmi?: number) => {
    if (!bmi) return { label: 'N/D', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' };
    if (bmi < 18.5) return { label: 'Poids faible', color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-950/60' };
    if (bmi < 25) return { label: 'Corpulence normale', color: 'text-emerald-800 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/60' };
    if (bmi < 30) return { label: 'Surpoids', color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/60' };
    return { label: 'Obésité', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/60' };
  };

  const handleExportCsv = () => {
    if (chartData.length === 0) return;
    const headers = ['Date', 'Heure', 'Systolique (mmHg)', 'Diastolique (mmHg)', 'Pouls (bpm)', 'Poids (kg)', 'Taille (cm)', 'IMC', 'Température (°C)', 'SpO2 (%)', 'Professionnel'];
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
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `constantes_${patient.familyName}_${patient.medicalRecordNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom Glass Tooltip with complete dark mode support
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const bpInterp = getBpStatus(data.systolic, data.diastolic);
      return (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-4 shadow-xl backdrop-blur-md text-xs space-y-2.5 min-w-[240px] text-slate-900 dark:text-slate-100">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-slate-100">{data.fullDateLabel}</span>
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
          </div>

          <div className="space-y-1.5">
            {data.systolic && data.diastolic && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    Pression Artérielle :
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm tabular-nums">
                    {data.systolic}/{data.diastolic}{' '}
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">mmHg</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pl-3.5 pt-0.5">
                  <span>Pression pulsée : {data.pulsePressure} mmHg</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${bpInterp.color} ${bpInterp.bg}`}>
                    {bpInterp.label}
                  </span>
                </div>
              </div>
            )}

            {data.pulseBpm && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-50 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-rose-600" />
                  Fréquence Cardiaque :
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {data.pulseBpm} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">bpm</span>
                </span>
              </div>
            )}

            {data.weightKg && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-50 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-teal-600" />
                  Poids / IMC :
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {data.weightKg} kg {data.bmi ? `· ${data.bmi} kg/m²` : ''}
                </span>
              </div>
            )}

            {data.oxygenSaturation && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-50 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-cyan-600" />
                  Saturation SpO₂ :
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {data.oxygenSaturation}%
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-2 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Opérateur :</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{data.measuredBy}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center space-y-4 shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
          <Activity className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Aucune constante vitale enregistrée</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Saisissez les constantes pour visualiser les graphiques interactifs Recharts de tension, pouls et profil pondéral.
          </p>
        </div>
        {onAddVitalsClick && (
          <button
            type="button"
            onClick={onAddVitalsClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/15 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Saisir une première mesure</span>
          </button>
        )}
      </div>
    );
  }

  const latestBpStatus = getBpStatus(stats?.latest.systolic, stats?.latest.diastolic);
  const latestPulseStatus = getPulseStatus(stats?.latest.pulseBpm);
  const latestBmiStatus = getBmiStatus(stats?.latest.bmi);

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-clinical transition-colors">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Surveillance & Tendances des Constantes
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Visualisation Recharts · {stats?.count} points de mesure enregistrés
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Time range selector */}
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTimeRange('all')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                timeRange === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tout
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('1year')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                timeRange === '1year'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              1 an
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('6months')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                timeRange === '6months'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              6 mois
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('3months')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                timeRange === '3months'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              3 mois
            </button>
          </div>

          {/* Toggle Thresholds */}
          <button
            type="button"
            onClick={() => setShowThresholds(!showThresholds)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
              showThresholds
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Info className="h-3.5 w-3.5" />
            <span>Cibles cliniques</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            title="Exporter l'historique en CSV"
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          {onAddVitalsClick && (
            <button
              type="button"
              onClick={onAddVitalsClick}
              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Saisir</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Card 1 : Tension Artérielle */}
        <div
          onClick={() => setMetricView('bp')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-clinical ${
            metricView === 'bp'
              ? 'border-blue-500 bg-gradient-to-b from-blue-50/70 dark:from-blue-950/40 to-white dark:to-slate-900 ring-2 ring-blue-500/20'
              : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                <Activity className="h-3.5 w-3.5" />
              </span>
              Pression Artérielle (TA)
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${latestBpStatus.color} ${latestBpStatus.bg}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${latestBpStatus.dot}`} />
              {latestBpStatus.label}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="font-mono text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
                {stats?.latest.systolic}/{stats?.latest.diastolic}
              </span>
              <span className="ml-1 text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">mmHg</span>
            </div>
            {stats?.avgSys && stats?.avgDia && (
              <div className="text-right">
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Moyenne</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                  {stats.avgSys}/{stats.avgDia}
                </span>
              </div>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Pression pulsée : {stats?.latest.pulsePressure || '—'} mmHg</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">Voir courbe &rarr;</span>
          </div>
        </div>

        {/* Card 2 : Pouls */}
        <div
          onClick={() => setMetricView('heartRate')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-clinical ${
            metricView === 'heartRate'
              ? 'border-rose-500 bg-gradient-to-b from-rose-50/70 dark:from-rose-950/40 to-white dark:to-slate-900 ring-2 ring-rose-500/20'
              : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300">
                <Heart className="h-3.5 w-3.5" />
              </span>
              Fréquence Cardiaque
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${latestPulseStatus.color} ${latestPulseStatus.bg}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${latestPulseStatus.dot}`} />
              {latestPulseStatus.label}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="font-mono text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
                {stats?.latest.pulseBpm || '—'}
              </span>
              <span className="ml-1 text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">bpm</span>
            </div>
            {stats?.avgPulse && (
              <div className="text-right">
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Moyenne</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                  {stats.avgPulse} bpm
                </span>
              </div>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Min {stats?.minPulse} · Max {stats?.maxPulse} bpm</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold hover:underline">Voir courbe &rarr;</span>
          </div>
        </div>

        {/* Card 3 : Poids & IMC */}
        <div
          onClick={() => setMetricView('weight')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-clinical ${
            metricView === 'weight'
              ? 'border-teal-500 bg-gradient-to-b from-teal-50/70 dark:from-teal-950/40 to-white dark:to-slate-900 ring-2 ring-teal-500/20'
              : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300">
                <Scale className="h-3.5 w-3.5" />
              </span>
              Poids & Indice Corporel
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${latestBmiStatus.color} ${latestBmiStatus.bg}`}>
              IMC {stats?.latest.bmi || '—'}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="font-mono text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
                {stats?.latest.weightKg || '—'}
              </span>
              <span className="ml-1 text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">kg</span>
            </div>
            {stats && stats.weightDelta !== null && stats.weightDelta !== undefined && (
              <div
                className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
                  stats.weightDelta > 0
                    ? 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60'
                    : stats.weightDelta < 0
                    ? 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60'
                    : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
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
                  {stats.weightDelta > 0 ? `+${stats.weightDelta}` : stats.weightDelta} kg
                </span>
              </div>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Taille : {stats?.latest.heightCm} cm ({latestBmiStatus.label})</span>
            <span className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">Voir courbe &rarr;</span>
          </div>
        </div>
      </div>

      {/* 3. Metric Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setMetricView('bp')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
            metricView === 'bp'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Pression Artérielle (Systole / Diastole)</span>
        </button>

        <button
          type="button"
          onClick={() => setMetricView('heartRate')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
            metricView === 'heartRate'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Heart className="h-4 w-4" />
          <span>Fréquence Cardiaque (Pouls)</span>
        </button>

        <button
          type="button"
          onClick={() => setMetricView('weight')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
            metricView === 'weight'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>Suivi Pondéral & IMC</span>
        </button>

        <button
          type="button"
          onClick={() => setMetricView('all')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
            metricView === 'all'
              ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-md shadow-slate-900/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Vue Synthétique Complète</span>
        </button>
      </div>

      {/* 4. Main Chart Canvas Card */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-clinical transition-colors">
        {/* A. Blood Pressure View */}
        {metricView === 'bp' && (
          <div>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  Courbe Évolutive de la Pression Artérielle (mmHg)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Lignes directrices SFHTA : Cible optimale &lt; 130/80 mmHg · Seuil d'hypertension ≥ 140/90 mmHg
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  Systolique
                </span>
                <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-lg border border-teal-200 dark:border-teal-800">
                  <span className="h-2 w-2 rounded-full bg-teal-600" />
                  Diastolique
                </span>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 15, right: 25, left: -10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="sysGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="diaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                    axisLine={{ stroke: chartTheme.axis }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[50, 180]}
                    ticks={[60, 80, 90, 110, 120, 140, 160]}
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                    axisLine={{ stroke: chartTheme.axis }}
                    tickLine={false}
                    unit=" mmHg"
                  />
                  <Tooltip content={<CustomTooltip />} />

                  {showThresholds && (
                    <>
                      {/* Hypertension Stage 1 Thresholds */}
                      <ReferenceLine
                        y={140}
                        stroke={chartTheme.refLineHta}
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: 'Seuil HTA Sys (140)',
                          fill: chartTheme.refLineHta,
                          fontSize: 10,
                          fontWeight: 700,
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
                      {/* Optimal Normotension Zone */}
                      <ReferenceArea
                        y1={60}
                        y2={80}
                        fill={chartTheme.refAreaNormo}
                        fillOpacity={isDark ? 0.12 : 0.08}
                      />
                      <ReferenceArea
                        y1={110}
                        y2={130}
                        fill="#3b82f6"
                        fillOpacity={isDark ? 0.12 : 0.08}
                      />
                    </>
                  )}

                  <Area
                    type="monotone"
                    dataKey="systolic"
                    name="Systolique"
                    fill="url(#sysGradient)"
                    stroke="#2563eb"
                    strokeWidth={3}
                    activeDot={{ r: 7, stroke: '#1d4ed8', strokeWidth: 3, fill: '#ffffff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="diastolic"
                    name="Diastolique"
                    fill="url(#diaGradient)"
                    stroke="#0d9488"
                    strokeWidth={3}
                    activeDot={{ r: 7, stroke: '#0f766e', strokeWidth: 3, fill: '#ffffff' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* B. Heart Rate View */}
        {metricView === 'heartRate' && (
          <div>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-600" />
                  Courbe de la Fréquence Cardiaque de Repos (bpm)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Intervalle physiologique de repos : 60 à 100 battements/minute (Régulier)
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800">
                  <span className="h-2 w-2 rounded-full bg-rose-600" />
                  Pouls (bpm)
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-mono">
                  Moyenne : <strong className="text-slate-900 dark:text-slate-100">{stats?.avgPulse} bpm</strong>
                </span>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 15, right: 25, left: -10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="heartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                    axisLine={{ stroke: chartTheme.axis }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[45, 120]}
                    ticks={[50, 60, 70, 80, 90, 100, 110]}
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                    axisLine={{ stroke: chartTheme.axis }}
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
                        fillOpacity={isDark ? 0.12 : 0.08}
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
                    stroke="#e11d48"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#heartGradient)"
                    activeDot={{ r: 7, stroke: '#be123c', strokeWidth: 3, fill: '#ffffff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* C. Weight & BMI View */}
        {metricView === 'weight' && (
          <div>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal-600" />
                  Courbe Pondérale & Évolution de l'IMC
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Variation totale :{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold tabular-nums">
                    {stats?.weightDelta && stats.weightDelta > 0
                      ? `+${stats.weightDelta}`
                      : stats?.weightDelta}{' '}
                    kg
                  </strong>{' '}
                  sur la période analysée
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-lg border border-teal-200 dark:border-teal-800">
                  <span className="h-2 w-2 rounded-full bg-teal-600" />
                  Poids (kg - axe G)
                </span>
                <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800">
                  <span className="h-2 w-2 rounded-full bg-purple-600" />
                  IMC (kg/m² - axe D)
                </span>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 15, right: 25, left: -10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                    axisLine={{ stroke: chartTheme.axis }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="weight"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11, fill: isDark ? '#2dd4bf' : '#0f766e' }}
                    axisLine={{ stroke: chartTheme.axis }}
                    tickLine={false}
                    unit=" kg"
                  />
                  <YAxis
                    yAxisId="bmi"
                    orientation="right"
                    domain={[16, 35]}
                    ticks={[18.5, 25, 30]}
                    tick={{ fontSize: 11, fill: isDark ? '#c084fc' : '#7c3aed' }}
                    axisLine={{ stroke: chartTheme.axis }}
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
                      fillOpacity={isDark ? 0.12 : 0.07}
                    />
                  )}

                  <Area
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weightKg"
                    name="Poids (kg)"
                    fill="url(#weightGrad)"
                    stroke="#0d9488"
                    strokeWidth={3}
                    activeDot={{ r: 7, stroke: '#0f766e', strokeWidth: 3, fill: '#ffffff' }}
                  />
                  <Line
                    yAxisId="bmi"
                    type="monotone"
                    dataKey="bmi"
                    name="IMC"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={{ r: 4.5, stroke: '#6d28d9', strokeWidth: 2, fill: '#ffffff' }}
                    activeDot={{ r: 7, fill: '#8b5cf6' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* D. Multi-Metric Panoramic View */}
        {metricView === 'all' && (
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-blue-600" />
                  1. Profil Tensionnel (Systole / Diastole)
                </h4>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  Dernier : {stats?.latest.systolic}/{stats?.latest.diastolic} mmHg
                </span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 15, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridSubtle} vertical={false} />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: chartTheme.tick }} tickLine={false} />
                    <YAxis domain={[60, 170]} tick={{ fontSize: 10, fill: chartTheme.tick }} tickLine={false} unit=" mmHg" />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={140} stroke={chartTheme.refLineHta} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="systolic" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3.5 }} />
                    <Line type="monotone" dataKey="diastolic" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3.5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5 text-rose-600" />
                    2. Fréquence Cardiaque (Pouls)
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-bold tabular-nums">
                    {stats?.latest.pulseBpm} bpm
                  </span>
                </div>
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 15, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridSubtle} vertical={false} />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: chartTheme.tick }} tickLine={false} />
                      <YAxis domain={[50, 110]} tick={{ fontSize: 10, fill: chartTheme.tick }} tickLine={false} unit=" bpm" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="pulseBpm" stroke="#e11d48" fill={isDark ? '#4c0519' : '#ffe4e6'} strokeWidth={2.5} dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-teal-600" />
                    3. Suivi Pondéral (kg)
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-bold tabular-nums">
                    {stats?.latest.weightKg} kg (IMC {stats?.latest.bmi})
                  </span>
                </div>
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 15, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridSubtle} vertical={false} />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: chartTheme.tick }} tickLine={false} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: chartTheme.tick }} tickLine={false} unit=" kg" />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="weightKg" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3.5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Historical Data Table */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-clinical overflow-hidden transition-colors">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/90 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Journal Chronologique des Mesures ({chartData.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Certifié HDS · Traçabilité praticien nominative
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Date & Heure</th>
                <th className="px-4 py-3">Pression Artérielle</th>
                <th className="px-4 py-3">Pouls</th>
                <th className="px-4 py-3">Poids & IMC</th>
                <th className="px-4 py-3">Température</th>
                <th className="px-4 py-3">SpO₂</th>
                <th className="px-4 py-3">Professionnel</th>
                <th className="px-4 py-3 text-right">Statut Clinique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...chartData].reverse().map((item, idx) => {
                const bpStatus = getBpStatus(item.systolic, item.diastolic);
                return (
                  <tr key={item.id || idx} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {item.fullDateLabel}
                    </td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      <span
                        className={`font-bold text-sm tabular-nums ${
                          item.systolic && item.systolic >= 140
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {item.systolic}/{item.diastolic}
                      </span>{' '}
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">mmHg</span>
                    </td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      <span
                        className={`font-bold tabular-nums ${
                          item.pulseBpm && (item.pulseBpm > 100 || item.pulseBpm < 60)
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {item.pulseBpm || '—'}
                      </span>{' '}
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">bpm</span>
                    </td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{item.weightKg || '—'} kg</span>
                      {item.bmi && (
                        <span className="ml-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                          (IMC {item.bmi})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap tabular-nums">
                      {item.temperatureC ? `${item.temperatureC}°C` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap tabular-nums">
                      {item.oxygenSaturation ? `${item.oxygenSaturation}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap font-medium">
                      {item.measuredBy}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${bpStatus.color} ${bpStatus.bg}`}
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
      </div>
    </div>
  );
};

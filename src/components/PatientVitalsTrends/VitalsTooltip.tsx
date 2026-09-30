import React from 'react';
import { ChartDataPoint } from './types';
import { getBpStatus } from './clinicalStatus';

interface VitalsTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
}

/**
 * Tooltip personnalisé pour les graphiques Recharts.
 *
 * Affiche :
 *  - Date complète + point pulsant
 *  - Tension artérielle (avec interprétation HAS + pression pulsée)
 *  - Poids + IMC
 *  - Fréquence cardiaque
 *  - SpO₂
 *  - Professionnel ayant mesuré
 *
 * Extrait du composant original sans modification visuelle.
 * Utilise getBpStatus() (extrait dans clinicalStatus.ts) pour l'interprétation clinique.
 */
export const VitalsTooltip: React.FC<VitalsTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const bpInterp = getBpStatus(data.systolic, data.diastolic);

  return (
    <div className="border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-4 shadow-2xl backdrop-blur-md text-xs space-y-2.5 min-w-[250px] text-slate-900 dark:text-slate-100 z-50">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
        <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
          {data.fullDateLabel}
        </span>
        <span className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-ping" />
      </div>

      <div className="space-y-2">
        {data.systolic && data.diastolic && (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-blue-300 dark:ring-blue-900" />
                Pression Artérielle :
              </span>
              <span className="font-mono font-extrabold text-slate-950 dark:text-white text-base tabular-nums">
                {data.systolic}/{data.diastolic}{' '}
                <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                  mmHg
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 pl-4 pt-1">
              <span>Pression pulsée : {data.pulsePressure} mmHg</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 ${bpInterp.color} ${bpInterp.bg}`}
              >
                {bpInterp.label}
              </span>
            </div>
          </div>
        )}

        {data.weightKg && (
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800">
            <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 font-bold">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 ring-2 ring-emerald-300 dark:ring-emerald-900" />
              Poids corporel :
            </span>
            <span className="font-mono font-extrabold text-slate-950 dark:text-white text-sm tabular-nums">
              {data.weightKg} kg {data.bmi ? `· IMC ${data.bmi}` : ''}
            </span>
          </div>
        )}

        {data.pulseBpm && (
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800">
            <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 font-bold">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600 ring-2 ring-rose-300 dark:ring-rose-900" />
              Fréquence Cardiaque :
            </span>
            <span className="font-mono font-extrabold text-slate-950 dark:text-white text-sm tabular-nums">
              {data.pulseBpm}{' '}
              <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                bpm
              </span>
            </span>
          </div>
        )}

        {data.oxygenSaturation && (
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800">
            <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 font-bold">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-600 ring-2 ring-cyan-300 dark:ring-cyan-900" />
              Saturation SpO₂ :
            </span>
            <span className="font-mono font-extrabold text-slate-950 dark:text-white text-sm tabular-nums">
              {data.oxygenSaturation}%
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 pt-2 text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between">
        <span className="font-medium">Mesuré par :</span>
        <span className="font-bold text-slate-900 dark:text-slate-100">{data.measuredBy}</span>
      </div>
    </div>
  );
};

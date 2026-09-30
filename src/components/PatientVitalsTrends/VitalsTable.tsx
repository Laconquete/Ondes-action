import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { ChartDataPoint } from './types';
import { getBpStatus } from './clinicalStatus';

interface VitalsTableProps {
  chartData: ChartDataPoint[];
  showFullTable: boolean;
  onToggleTable: () => void;
}

/**
 * Tableau détaillé des mesures vitales (collapsible).
 *
 * Affiche toutes les mesures en ordre antichronologique avec :
 *  - Date & Heure (fullDateLabel)
 *  - Pression Artérielle (colorée si ≥140)
 *  - Pouls (coloré si >100 ou <60)
 *  - Poids & IMC
 *  - Température
 *  - SpO₂
 *  - Praticien
 *  - Statut (badge HAS basé sur getBpStatus)
 *
 * Extrait du composant original (lignes ~971-1073) sans modification visuelle.
 */
export const VitalsTable: React.FC<VitalsTableProps> = ({
  chartData,
  showFullTable,
  onToggleTable,
}) => {
  return (
    <>
      <button
        type="button"
        onClick={onToggleTable}
        className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
      >
        <span>{showFullTable ? 'Masquer le tableau' : 'Afficher les valeurs numériques'}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${showFullTable ? 'rotate-180' : ''}`} />
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
    </>
  );
};

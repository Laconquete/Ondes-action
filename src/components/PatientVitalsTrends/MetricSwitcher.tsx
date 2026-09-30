import React from 'react';
import { Activity, Heart, Layers, Scale, Sparkles } from 'lucide-react';
import type { MetricView } from './types';

interface MetricSwitcherProps {
  metricView: MetricView;
  onChange: (view: MetricView) => void;
}

/**
 * Onglets segmentés pour basculer entre les vues du graphique.
 *
 * 5 vues :
 *  - bp_weight : Tension & Poids combinés (vue recommandée, 6 mois)
 *  - bp        : Tension artérielle seule
 *  - weight    : Poids & IMC seul
 *  - heartRate : Fréquence cardiaque seule
 *  - all       : Vue panoramique complète
 *
 * Extrait du composant original (lignes ~549-615) sans modification visuelle.
 */
export const MetricSwitcher: React.FC<MetricSwitcherProps> = ({ metricView, onChange }) => {
  const tabs: Array<{
    view: MetricView;
    icon: React.ElementType;
    label: string;
    activeBg: string;
  }> = [
    { view: 'bp_weight', icon: Sparkles, label: 'Tension & Poids (Vue Recommandée 6 mois)', activeBg: 'bg-blue-600 shadow-blue-500/20' },
    { view: 'bp', icon: Activity, label: 'Tension Artérielle seule', activeBg: 'bg-blue-600 shadow-blue-500/20' },
    { view: 'weight', icon: Scale, label: 'Poids & IMC seul', activeBg: 'bg-emerald-600 shadow-emerald-500/20' },
    { view: 'heartRate', icon: Heart, label: 'Fréquence Cardiaque', activeBg: 'bg-rose-600 shadow-rose-500/20' },
    { view: 'all', icon: Layers, label: 'Vue Panoramique Complète', activeBg: 'bg-slate-900 dark:bg-slate-700 shadow-slate-900/20' },
  ];

  return (
    <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2.5 overflow-x-auto">
      {tabs.map(({ view, icon: Icon, label, activeBg }) => (
        <button
          key={view}
          type="button"
          onClick={() => onChange(view)}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
            metricView === view
              ? `${activeBg} text-white shadow-md`
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

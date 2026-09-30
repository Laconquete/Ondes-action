import React from 'react';
import { Activity, Plus } from 'lucide-react';
import type { TimeRange } from './types';

interface VitalsEmptyStateProps {
  timeRange: TimeRange;
  onShowAllHistory: () => void;
  onAddVitalsClick?: () => void;
}

/**
 * État vide affiché quand le patient n'a aucune constante sur la période sélectionnée.
 *
 * Affiche :
 *  - Icône Activity (cœur pulsant)
 *  - Titre indiquant la période filtrée
 *  - Description avec suggestion de bascule
 *  - 2 actions : "Afficher tout l'historique" + "Saisir une mesure"
 *
 * Extrait du composant original (lignes 453-488) sans modification visuelle.
 */
export const VitalsEmptyState: React.FC<VitalsEmptyStateProps> = ({
  timeRange,
  onShowAllHistory,
  onAddVitalsClick,
}) => {
  const periodLabel: Record<TimeRange, string> = {
    '6months': '6 derniers mois',
    '3months': '3 derniers mois',
    '1year': '12 derniers mois',
    all: 'tout l\'historique',
  };

  return (
    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center space-y-3 shadow-xs">
      <div className="mx-auto flex h-12 w-12 items-center justify-center bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
        <Activity className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Aucune constante pour cette période ({periodLabel[timeRange]})
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
          Basculez sur « Tout » pour afficher l'historique complet ou saisissez une nouvelle mesure.
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 pt-1">
        <button
          type="button"
          onClick={onShowAllHistory}
          className="border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200"
        >
          Afficher tout l'historique
        </button>
        {onAddVitalsClick && (
          <button
            type="button"
            onClick={onAddVitalsClick}
            className="inline-flex items-center gap-1.5 bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Saisir une mesure</span>
          </button>
        )}
      </div>
    </div>
  );
};

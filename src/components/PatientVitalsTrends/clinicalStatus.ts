import type { BpStatus } from './types';

/**
 * Interprétation clinique d'une mesure de tension artérielle.
 * Seuils HAS (Haute Autorité de Santé) — extraits du composant original
 * pour permettre leur réutilisation dans les KPI cards, le tooltip, et les badges.
 *
 * NOTE : ces seuils sont légèrement différents de clinicalAlertsEngine.ts
 * (qui utilise les seuils SFHTA stricts avec crises hypertensives).
 * Ici, on reste sur la grille HAS historique utilisée depuis la v1.
 */
export function getBpStatus(sys?: number, dia?: number): BpStatus {
  if (!sys || !dia) {
    return {
      label: 'Non mesuré',
      color: 'text-slate-800 dark:text-slate-200',
      bg: 'bg-slate-100 dark:bg-slate-800',
      dot: 'bg-slate-500',
    };
  }
  if (sys >= 140 || dia >= 90) {
    return {
      label: 'HTA Stade 1 (≥140/90)',
      color: 'text-red-900 dark:text-red-200',
      bg: 'bg-red-100 dark:bg-red-950/80 border border-red-300 dark:border-red-700',
      dot: 'bg-red-600',
    };
  }
  if (sys >= 130 || dia >= 85) {
    return {
      label: 'Normale Haute (130-139)',
      color: 'text-amber-900 dark:text-amber-200',
      bg: 'bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700',
      dot: 'bg-amber-600',
    };
  }
  if (sys < 90 || dia < 60) {
    return {
      label: 'Hypotension (<90/60)',
      color: 'text-purple-900 dark:text-purple-200',
      bg: 'bg-purple-100 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-700',
      dot: 'bg-purple-600',
    };
  }
  return {
    label: 'Cible Optimale (<130/80)',
    color: 'text-emerald-950 dark:text-emerald-200',
    bg: 'bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700',
    dot: 'bg-emerald-600',
  };
}

/**
 * Interprétation clinique de la fréquence cardiaque.
 */
export function getPulseStatus(pulse?: number): BpStatus {
  if (!pulse) {
    return {
      label: 'Non mesuré',
      color: 'text-slate-800 dark:text-slate-200',
      bg: 'bg-slate-100 dark:bg-slate-800',
      dot: 'bg-slate-500',
    };
  }
  if (pulse > 100) {
    return {
      label: 'Tachycardie (>100)',
      color: 'text-amber-950 dark:text-amber-200',
      bg: 'bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700',
      dot: 'bg-amber-600',
    };
  }
  if (pulse < 60) {
    return {
      label: 'Bradycardie (<60)',
      color: 'text-indigo-950 dark:text-indigo-200',
      bg: 'bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-300 dark:border-indigo-700',
      dot: 'bg-indigo-600',
    };
  }
  return {
    label: 'Sinusal Régulier',
    color: 'text-emerald-950 dark:text-emerald-200',
    bg: 'bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700',
    dot: 'bg-emerald-600',
  };
}

/**
 * Interprétation clinique de l'IMC (Indice de Masse Corporelle).
 */
export function getBmiStatus(bmi?: number): { label: string; color: string; bg: string } {
  if (!bmi) {
    return {
      label: 'N/D',
      color: 'text-slate-800 dark:text-slate-200',
      bg: 'bg-slate-100 dark:bg-slate-800',
    };
  }
  if (bmi < 18.5) {
    return {
      label: 'Poids faible (<18.5)',
      color: 'text-indigo-950 dark:text-indigo-200',
      bg: 'bg-indigo-100 dark:bg-indigo-950/80',
    };
  }
  if (bmi < 25) {
    return {
      label: 'Corpulence normale (18.5-24.9)',
      color: 'text-emerald-950 dark:text-emerald-200',
      bg: 'bg-emerald-100 dark:bg-emerald-950/80',
    };
  }
  if (bmi < 30) {
    return {
      label: 'Surpoids (25-29.9)',
      color: 'text-amber-950 dark:text-amber-200',
      bg: 'bg-amber-100 dark:bg-amber-950/80',
    };
  }
  return {
    label: 'Obésité (≥30)',
    color: 'text-red-950 dark:text-red-200',
    bg: 'bg-red-100 dark:bg-red-950/80',
  };
}

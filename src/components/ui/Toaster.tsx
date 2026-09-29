import React from 'react';
import {
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { useToastStore, ToastVariant } from '../../stores/toastStore';

const variantConfig: Record<
  ToastVariant,
  { icon: React.ElementType; bg: string; border: string; text: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-900 dark:text-emerald-100',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    icon: AlertOctagon,
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800',
    text: 'text-rose-900 dark:text-rose-100',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-900 dark:text-amber-100',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-900 dark:text-blue-100',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
};

export const Toaster: React.FC = () => {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[1300] flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const config = variantConfig[t.variant];
        const Icon = config.icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 max-w-sm min-w-[320px] p-3.5 border ${config.bg} ${config.border} shadow-lg animate-slideInRight`}
            role="alert"
          >
            <Icon className={`h-5 w-5 shrink-0 ${config.iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${config.text}`}>{t.title}</p>
              {t.message && (
                <p className={`text-[11px] mt-0.5 ${config.text} opacity-80`}>{t.message}</p>
              )}
              {t.actionLabel && t.onAction && (
                <button
                  onClick={() => {
                    t.onAction?.();
                    dismiss(t.id);
                  }}
                  className={`mt-2 text-[11px] font-bold underline ${config.iconColor}`}
                >
                  {t.actionLabel}
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className={`shrink-0 p-0.5 ${config.text} opacity-50 hover:opacity-100 transition-opacity`}
              aria-label="Fermer la notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';
export type ToastDuration = 'short' | 'normal' | 'long';

interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  duration: number; // en ms
  createdAt: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastState {
  toasts: ToastItem[];
  show: (toast: Omit<ToastItem, 'id' | 'createdAt'> & { duration?: ToastDuration | number }) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const DURATIONS: Record<ToastDuration, number> = {
  short: 3000,
  normal: 5000,
  long: 8000,
};

function resolveDuration(d?: ToastDuration | number): number {
  if (typeof d === 'number') return d;
  return DURATIONS[d || 'normal'];
}

function generateId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (toast) => {
    const id = generateId();
    const item: ToastItem = {
      ...toast,
      id,
      duration: resolveDuration(toast.duration),
      createdAt: Date.now(),
    };
    set((state) => ({ toasts: [...state.toasts, item] }));

    // Auto-dismiss
    setTimeout(() => {
      get().dismiss(id);
    }, item.duration);

    return id;
  },

  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  clearAll: () => set({ toasts: [] }),
}));

/**
 * Helpers pour usage direct sans hook.
 * Usage : toast.success('Note signée', 'La note SOAP a été signée électroniquement.');
 */
export const toast = {
  success: (title: string, message?: string, duration: ToastDuration = 'normal') =>
    useToastStore.getState().show({ title, message, variant: 'success', duration: DURATIONS[duration] }),
  error: (title: string, message?: string, duration: ToastDuration = 'long') =>
    useToastStore.getState().show({ title, message, variant: 'error', duration: DURATIONS[duration] }),
  warning: (title: string, message?: string, duration: ToastDuration = 'normal') =>
    useToastStore.getState().show({ title, message, variant: 'warning', duration: DURATIONS[duration] }),
  info: (title: string, message?: string, duration: ToastDuration = 'normal') =>
    useToastStore.getState().show({ title, message, variant: 'info', duration: DURATIONS[duration] }),
  withAction: (
    title: string,
    message: string,
    actionLabel: string,
    onAction: () => void,
    variant: ToastVariant = 'info'
  ) =>
    useToastStore.getState().show({
      title,
      message,
      variant,
      duration: DURATIONS.long,
      actionLabel,
      onAction,
    }),
};

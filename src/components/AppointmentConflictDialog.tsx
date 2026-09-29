import React from 'react';
import { AlertTriangle, Clock, Calendar, X } from 'lucide-react';
import { Appointment } from '../types/clinical';

interface AppointmentConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflictingAppointment: Appointment;
  requestedSlot: { startsAt: string; endsAt: string };
  suggestedSlots: Array<{ startsAt: string; endsAt: string; label: string }>;
  onSelectAlternative: (slot: { startsAt: string; endsAt: string }) => void;
}

export const AppointmentConflictDialog: React.FC<AppointmentConflictDialogProps> = ({
  isOpen,
  onClose,
  conflictingAppointment,
  requestedSlot,
  suggestedSlots,
  onSelectAlternative,
}) => {
  if (!isOpen) return null;

  const reqStart = new Date(requestedSlot.startsAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const reqEnd = new Date(requestedSlot.endsAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const conflictStart = new Date(conflictingAppointment.startsAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const conflictEnd = new Date(conflictingAppointment.endsAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Créneau indisponible — Conflit d'agenda
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {conflictingAppointment.practitionerName} a déjà un engagement sur cette plage horaire.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/40 p-3.5 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center justify-between font-medium">
            <span>Créneau demandé :</span>
            <span className="font-mono font-bold tabular-nums">{reqStart} – {reqEnd}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-amber-800 dark:text-amber-300">
            <span>Rendez-vous concurrent :</span>
            <span className="font-mono tabular-nums">
              {conflictStart} – {conflictEnd} ({conflictingAppointment.roomCode})
            </span>
          </div>
          <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
            Conformément aux règles HDS de confidentialité, le motif médical du tiers est masqué.
          </p>
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>Créneaux alternatifs disponibles recommandés</span>
          </div>

          <div className="mt-2.5 space-y-2">
            {suggestedSlots.map((slot, index) => (
              <button
                key={index}
                onClick={() => onSelectAlternative(slot)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 hover:text-blue-900 dark:hover:text-blue-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <span>{slot.label}</span>
                </div>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  Choisir ce créneau &rarr;
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Modifier manuellement
          </button>
        </div>
      </div>
    </div>
  );
};

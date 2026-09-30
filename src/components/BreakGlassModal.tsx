import React, { useState } from 'react';
import { AlertOctagon, ShieldAlert, X } from 'lucide-react';
import { AppUser, Patient } from '../types/clinical';

interface BreakGlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  patients: Patient[];
  onConfirmBreakGlass: (patientId: string, reason: string, durationMinutes: number) => void;
}

export const BreakGlassModal: React.FC<BreakGlassModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  patients,
  onConfirmBreakGlass,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const [reasonCode, setReasonCode] = useState('URGENCE_VITALE');
  const [justification, setJustification] = useState('');
  const [confirmedRisk, setConfirmedRisk] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim() || !confirmedRisk) return;

    onConfirmBreakGlass(
      selectedPatientId,
      `${reasonCode}: ${justification.trim()}`,
      60 // 60 minutes session d'urgence
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg border border-red-300 dark:border-red-900/70 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-red-950 dark:text-red-100">
                Procédure de Bris de Glace (Break-Glass)
              </h3>
              <p className="text-xs text-red-800 dark:text-red-300 mt-0.5">
                Accès exceptionnel d'urgence aux données de santé
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-3.5 text-xs text-red-900 dark:text-red-200 space-y-1">
          <p className="font-bold">Avertissement de sécurité et de conformité HDS :</p>
          <p className="text-[11px] text-red-800 dark:text-red-300 leading-relaxed">
            Le déclenchement d'un bris de glace outrepasse les règles d'équipe de soins habituelles. Cette action est <strong>immédiatement notifiée au DPO et au responsable de sécurité</strong> et inscrite dans le registre immuable d'audit.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Dossier patient concerné
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 p-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id} className="dark:bg-slate-900 dark:text-slate-100">
                  {p.familyName.toUpperCase()} {p.givenName} ({p.medicalRecordNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Motif réglementaire d'urgence
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 p-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="URGENCE_VITALE">Urgence vitale immédiate — Pronostic engagé</option>
              <option value="PATIENT_INCONSCIENT">Patient inconscient / incapable d'exprimer son consentement</option>
              <option value="ACCUEIL_NON_PROGRAMME">Prise en charge imprévue hors équipe habituelle</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Justification clinique détaillée (obligatoire) *
            </label>
            <textarea
              required
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Décrire le contexte clinique exact nécessitant la levée immédiate de restriction d'accès..."
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="confirm-risk"
              checked={confirmedRisk}
              onChange={(e) => setConfirmedRisk(e.target.checked)}
              className="mt-0.5 rounded text-red-600 focus:ring-red-500 cursor-pointer"
            />
            <label htmlFor="confirm-risk" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              J'atteste sur l'honneur ({currentUser.displayName}) que cette levée d'accès est strictement nécessaire à la continuité ou à l'urgence des soins du patient.
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!confirmedRisk || !justification.trim()}
              className="bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:cursor-not-allowed shadow-xs cursor-pointer"
            >
              Déclencher le bris de glace (60 min)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

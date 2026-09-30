import React, { useState, useMemo } from 'react';
import { X, ArrowRight, User, Search, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { Patient, AppUser } from '../types/clinical';

interface TransferPatientDialogProps {
  patient: Patient;
  currentUser: AppUser;
  doctors: AppUser[];
  onTransfer: (patient: Patient, toDoctor: AppUser) => void;
  onRelease: (patientId: string) => void;
  onClose: () => void;
}

/**
 * Dialogue de transfert de patient.
 *
 * Permet à un médecin titulaire de :
 *  1. Transférer le patient vers un autre médecin (avec recherche + sélection)
 *  2. Libérer le patient (il redevient consultable par tous en "Vue équipe")
 *
 * Extrait dans un composant dédié pour éviter d'alourdir DoctorWorkspace.
 */
export const TransferPatientDialog: React.FC<TransferPatientDialogProps> = ({
  patient,
  currentUser,
  doctors,
  onTransfer,
  onRelease,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<AppUser | null>(null);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);

  // Filtrer les médecins (exclure l'utilisateur courant)
  const availableDoctors = useMemo(() => {
    return doctors.filter((d) =>
      d.role === 'doctor' &&
      d.id !== currentUser.id &&
      (
        searchTerm.trim() === '' ||
        d.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.department.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [doctors, currentUser.id, searchTerm]);

  const handleTransfer = () => {
    if (!selectedDoctor) return;
    onTransfer(patient, selectedDoctor);
    onClose();
  };

  const handleRelease = () => {
    onRelease(patient.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-fadeInScale">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              <ArrowRight className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Transférer le patient
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {patient.familyName} {patient.givenName} · {patient.medicalRecordNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-4">
          {/* Statut actuel */}
          <div className="p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 text-xs">
              {patient.isReserved ? (
                <>
                  <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    Réservé par {patient.reservedByName || 'un médecin'}
                  </span>
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    Patient libre (consultable par tous)
                  </span>
                </>
              )}
            </div>
            {patient.reservedReason && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 ml-6">
                Motif : {patient.reservedReason}
              </p>
            )}
          </div>

          {/* Option 1 : Transférer */}
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Option 1 — Transférer vers un autre médecin
            </h3>

            {/* Recherche médecin */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un médecin..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Liste des médecins */}
            <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800">
              {availableDoctors.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Aucun médecin trouvé.
                </div>
              ) : (
                availableDoctors.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoctor(doc)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors ${
                      selectedDoctor?.id === doc.id
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-l-4 border-l-blue-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                      {doc.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {doc.displayName}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {doc.department}
                      </div>
                    </div>
                    {selectedDoctor?.id === doc.id && (
                      <ArrowRight className="h-4 w-4 text-blue-600" />
                    )}
                  </button>
                ))
              )}
            </div>

            <button
              onClick={handleTransfer}
              disabled={!selectedDoctor}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2 text-xs font-bold transition-colors"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Transférer vers {selectedDoctor?.displayName || '...'}
            </button>
          </div>

          {/* Séparateur */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Option 2 : Libérer */}
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Option 2 — Libérer le patient
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
              Le patient redeviendra consultable par tous les médecins en "Vue équipe".
            </p>

            {!showReleaseConfirm ? (
              <button
                onClick={() => setShowReleaseConfirm(true)}
                className="w-full flex items-center justify-center gap-2 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 py-2 text-xs font-bold transition-colors"
              >
                <Unlock className="h-3.5 w-3.5" />
                Libérer le patient
              </button>
            ) : (
              <div className="p-3 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 dark:text-amber-200">
                    Êtes-vous sûr ? Tous les médecins pourront consulter ce patient.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRelease}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-1.5 text-xs font-bold transition-colors"
                  >
                    Oui, libérer
                  </button>
                  <button
                    onClick={() => setShowReleaseConfirm(false)}
                    className="flex-1 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-1.5 text-xs font-bold transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
            🔒 Toute action est journalisée dans l'audit trail (SHA-256 chaîné)
          </p>
        </div>
      </div>
    </div>
  );
};

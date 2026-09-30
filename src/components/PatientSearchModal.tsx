import React, { useState, useEffect } from 'react';
import { Search, X, User, Calendar, AlertTriangle } from 'lucide-react';
import { Patient, Appointment } from '../types/clinical';

interface PatientSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  appointments: Appointment[];
  onSelectPatient: (patientId: string) => void;
}

export const PatientSearchModal: React.FC<PatientSearchModalProps> = ({
  isOpen,
  onClose,
  patients,
  appointments,
  onSelectPatient,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // handled in parent or toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = patients.filter((p) => {
    const q = query.toLowerCase();
    return (
      p.familyName.toLowerCase().includes(q) ||
      p.givenName.toLowerCase().includes(q) ||
      p.medicalRecordNumber.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.birthDate.includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden transition-colors">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 bg-slate-50/70 dark:bg-slate-800/50">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher patient par nom, prénom, IPP, tél (Ctrl+K)..."
            className="w-full text-xs bg-transparent border-0 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <kbd className="hidden sm:inline-block bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300">
            ESC
          </kbd>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Aucun dossier patient ne correspond à votre recherche.
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelectPatient(p.id);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-blue-50/70 dark:hover:bg-slate-800/70 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs group-hover:bg-blue-100 dark:group-hover:bg-blue-950/70 group-hover:text-blue-800 dark:group-hover:text-blue-300">
                    {p.familyName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {p.familyName.toUpperCase()} {p.givenName}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {p.medicalRecordNumber}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Né(e) le {new Date(p.birthDate).toLocaleDateString('fr-FR')}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{p.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {p.allergies.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 px-1.5 py-0.5">
                      <AlertTriangle className="h-3 w-3" />
                      Allergie
                    </span>
                  )}
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Ouvrir &rarr;
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

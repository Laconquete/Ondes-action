import React from 'react';
import { RefreshCw, CheckCircle, Database, X, ShieldCheck } from 'lucide-react';
import { OutboxItem } from '../types/clinical';

interface OfflineSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  outbox: OutboxItem[];
  isOnline: boolean;
  onTriggerSync: () => void;
  lastSyncTime: string;
}

export const OfflineSyncModal: React.FC<OfflineSyncModalProps> = ({
  isOpen,
  onClose,
  outbox,
  isOnline,
  onTriggerSync,
  lastSyncTime,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Gestionnaire de Synchronisation Locale & Outbox
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Protocole de synchronisation chiffré et idempotent (Dexie / IndexedDB)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">État du réseau</span>
            <div className="mt-1 flex items-center gap-1.5 font-semibold">
              <span
                className={`h-2 w-2 rounded-full ${
                  isOnline ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50' : 'bg-amber-500 shadow-xs shadow-amber-500/50'
                }`}
              />
              <span className={isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                {isOnline ? 'Connecté au serveur HDS' : 'Mode Hors Ligne Actif'}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Dernière synchronisation</span>
            <p className="mt-1 font-mono font-medium text-slate-900 dark:text-slate-200">
              {new Date(lastSyncTime).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Mutations locales dans l'Outbox ({outbox.length})
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Curseur v2026.09.1
            </span>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800 p-2 bg-slate-50/50 dark:bg-slate-950/40">
            {outbox.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center gap-1.5">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span>Toutes les données locales sont synchronisées avec le serveur canonique.</span>
              </div>
            ) : (
              outbox.map((item) => (
                <div
                  key={item.id}
                  className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 p-2 text-xs flex items-center justify-between shadow-2xs"
                >
                  <div>
                    <span className="font-mono font-semibold text-blue-900 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1 py-0.5 rounded text-[10px]">
                      {item.operationType}
                    </span>
                    <span className="ml-2 text-slate-700 dark:text-slate-300 font-medium">
                      {item.aggregateType} · ID: {item.aggregateId.substring(0, 10)}...
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      Clé d'idempotence : {item.idempotencyKey}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      item.status === 'applied'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Chiffrement AES-GCM local actif</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={onTriggerSync}
              className="flex items-center gap-1.5 bg-blue-600 dark:bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-600 shadow-xs transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Forcer la synchronisation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

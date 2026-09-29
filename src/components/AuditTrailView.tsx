import React, { useState } from 'react';
import {
  Shield,
  Filter,
  Download,
  Search,
  Lock,
  CheckCircle,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { AuditEvent } from '../types/clinical';

interface AuditTrailViewProps {
  auditEvents: AuditEvent[];
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ auditEvents }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  const filteredEvents = auditEvents.filter((ev) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      ev.actorName.toLowerCase().includes(q) ||
      ev.action.toLowerCase().includes(q) ||
      (ev.patientName && ev.patientName.toLowerCase().includes(q)) ||
      (ev.eventHash && ev.eventHash.toLowerCase().includes(q)) ||
      (ev.reasonText && ev.reasonText.toLowerCase().includes(q));

    const matchAction = filterAction === 'all' || ev.action === filterAction;
    return matchSearch && matchAction;
  });

  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(auditEvents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `audit_trail_hds_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Journal d'Audit Immuable & Traçabilité HDS / RGPD ({auditEvents.length} événements scellés)
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Conformité CNIL / HDS : chaque lecture, signature, dérogation médicamenteuse ou bris de glace est scellé avec empreinte cryptographique.
            </p>
          </div>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Exporter le journal (JSON)</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par acteur, patient, action ou hash SHA-256..."
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">Toutes les actions</option>
              <option value="USER_LOGIN">Connexion</option>
              <option value="PATIENT_RECORD_VIEW">Consultation dossier</option>
              <option value="CLINICAL_NOTE_SIGN">Signature note clinique</option>
              <option value="MEDICATION_PRESCRIBE">Prescription</option>
              <option value="BREAK_GLASS_ACCESS">Bris de glace</option>
              <option value="QUEUE_TICKET_GENERATE">Ticket file d'attente</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-clinical overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
              <tr>
                <th className="py-3 px-4">Horodatage (UTC)</th>
                <th className="py-3 px-4">Acteur & Rôle</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Cible / Patient</th>
                <th className="py-3 px-4">Statut & Motif</th>
                <th className="py-3 px-4 font-mono">Empreinte SHA-256</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-normal">
              {filteredEvents.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">
                    {new Date(ev.occurredAt).toLocaleString('fr-FR')}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{ev.actorName}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-mono">
                      {ev.actorRole}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[11px] font-bold text-blue-900 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 border border-blue-200 dark:border-blue-800">
                      {ev.action}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {ev.patientName ? (
                      <span className="font-medium text-slate-900 dark:text-slate-100">{ev.patientName}</span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 italic">Système / Global</span>
                    )}
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          ev.outcome === 'allowed' ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                        {ev.reasonText || 'Opération autorisée'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="truncate block w-28 tabular-nums" title={ev.eventHash}>
                      {(ev.eventHash || '—').substring(0, 16)}...
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

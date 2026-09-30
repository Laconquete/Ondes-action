import React, { useState, useMemo } from 'react';
import {
  Activity,
  Check,
  X,
  Clock,
  Pill,
  Thermometer,
  Droplet,
  Stethoscope,
  Eye,
  BookOpen,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  User,
  Search,
} from 'lucide-react';
import {
  NursingCarePlan,
  NursingTask,
  MedicationAdministration,
  Patient,
  AppUser,
  VitalSignSet,
} from '../types/clinical';

interface NursingWorkspaceProps {
  currentUser: AppUser;
  carePlans: NursingCarePlan[];
  tasks: NursingTask[];
  administrations: MedicationAdministration[];
  patients: Patient[];
  onExecuteTask: (taskId: string, result: string) => void;
  onSkipTask: (taskId: string, reason: string) => void;
  onRecordAdministration: (admin: Omit<MedicationAdministration, 'id' | 'administeredBy' | 'administeredByName' | 'administeredAt'>) => void;
}

const TASK_TYPE_CONFIG: Record<NursingTask['type'], { icon: React.ElementType; label: string; color: string }> = {
  medication: { icon: Pill, label: 'Médicament', color: 'text-blue-600 dark:text-blue-400' },
  vitals_check: { icon: Activity, label: 'Constantes', color: 'text-rose-600 dark:text-rose-400' },
  biology: { icon: Droplet, label: 'Biologie', color: 'text-purple-600 dark:text-purple-400' },
  procedure: { icon: Stethoscope, label: 'Soin technique', color: 'text-emerald-600 dark:text-emerald-400' },
  observation: { icon: Eye, label: 'Observation', color: 'text-amber-600 dark:text-amber-400' },
  education: { icon: BookOpen, label: 'Éducation', color: 'text-indigo-600 dark:text-indigo-400' },
  other: { icon: MoreHorizontal, label: 'Autre', color: 'text-slate-600 dark:text-slate-400' },
};

/**
 * NursingWorkspace — Vue dédiée aux infirmiers.
 *
 * Affiche :
 *  1. La liste des patients avec un plan de soins actif
 *  2. Pour chaque patient : la checklist des directives du médecin
 *  3. Boutons "Exécuter" (✓) ou "Ignorer" (✗) sur chaque tâche
 *  4. Formulaire d'enregistrement d'administration médicamenteuse (MAR)
 *  5. Historique des administrations
 *  6. Barre de progression du plan (X% des tâches effectuées)
 */
export const NursingWorkspace: React.FC<NursingWorkspaceProps> = ({
  currentUser,
  carePlans,
  tasks,
  administrations,
  patients,
  onExecuteTask,
  onSkipTask,
  onRecordAdministration,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const [taskResult, setTaskResult] = useState('');
  const [skipTaskId, setSkipTaskId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [adminTaskId, setAdminTaskId] = useState<string | null>(null);
  const [adminEffect, setAdminEffect] = useState('');
  const [adminSideEffects, setAdminSideEffects] = useState('');

  // Plans actifs (filtrés par recherche)
  const activePlans = useMemo(() => {
    const filtered = carePlans.filter((p) => p.status === 'active');
    if (!searchTerm.trim()) return filtered;
    const q = searchTerm.toLowerCase();
    return filtered.filter((p) =>
      p.patientName.toLowerCase().includes(q) ||
      p.diagnosis.toLowerCase().includes(q)
    );
  }, [carePlans, searchTerm]);

  const getTasksForPlan = (planId: string) => tasks.filter((t) => t.carePlanId === planId);
  const getProgress = (planId: string) => {
    const planTasks = tasks.filter((t) => t.carePlanId === planId);
    const total = planTasks.length;
    const done = planTasks.filter((t) => t.status === 'done').length;
    const skipped = planTasks.filter((t) => t.status === 'skipped').length;
    return { total, done, pending: total - done - skipped, skipped, percentage: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  const handleExecute = (taskId: string) => {
    onExecuteTask(taskId, taskResult || 'Effectué');
    setExecutingTaskId(null);
    setTaskResult('');
  };

  const handleSkip = (taskId: string) => {
    if (skipReason.trim()) {
      onSkipTask(taskId, skipReason.trim());
      setSkipTaskId(null);
      setSkipReason('');
    }
  };

  const handleRecordAdmin = (task: NursingTask) => {
    if (!adminEffect.trim()) return;
    onRecordAdministration({
      patientId: task.patientId,
      patientName: patients.find((p) => p.id === task.patientId)?.familyName + ' ' + patients.find((p) => p.id === task.patientId)?.givenName || '',
      carePlanId: task.carePlanId,
      taskId: task.id,
      medicationOrderId: task.medicationOrderId,
      medicationDisplay: task.medicationDisplay || task.label,
      genericName: task.medicationDisplay || task.label,
      dosage: task.dosage || '',
      route: task.route || 'Orale',
      effectObserved: adminEffect.trim(),
      sideEffects: adminSideEffects.trim() || undefined,
      status: 'administered',
    });
    setAdminTaskId(null);
    setAdminEffect('');
    setAdminSideEffects('');
  };

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-clinical">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Carnet de Soins Infirmier
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {activePlans.length} plan(s) actif(s) · {tasks.filter(t => t.status === 'pending').length} tâche(s) en attente
            </p>
          </div>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un patient..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Plans actifs */}
      {activePlans.length === 0 ? (
        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Aucun plan de soins actif</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Les plans créés par les médecins apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activePlans.map((plan) => {
            const progress = getProgress(plan.id);
            const planTasks = getTasksForPlan(plan.id);
            const isExpanded = expandedPlanId === plan.id;
            const patientAdmins = administrations.filter((a) => a.carePlanId === plan.id);

            return (
              <div key={plan.id} className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-clinical overflow-hidden">
                {/* En-tête du plan */}
                <button
                  onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <div className="flex h-9 w-9 items-center justify-center bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
                      {plan.patientName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{plan.patientName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {plan.diagnosis} · Prescrit par {plan.prescribedByName}
                      </div>
                    </div>
                  </div>

                  {/* Barre de progression */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{progress.percentage}%</div>
                      <div className="text-[10px] text-slate-500">{progress.done}/{progress.total} tâches</div>
                    </div>
                    <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          progress.percentage === 100 ? 'bg-emerald-500' : progress.percentage >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>
                </button>

                {/* Corps du plan (dépliable) */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800">
                    {/* Directives générales */}
                    {plan.instructions && (
                      <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-start gap-2">
                          <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Directives du médecin</div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{plan.instructions}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Checklist des tâches */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {planTasks.map((task) => {
                        const config = TASK_TYPE_CONFIG[task.type];
                        const Icon = config.icon;
                        const isExecuting = executingTaskId === task.id;
                        const isSkipping = skipTaskId === task.id;
                        const isAdministering = adminTaskId === task.id;

                        return (
                          <div key={task.id} className={`p-3 ${task.status === 'done' ? 'opacity-60' : ''}`}>
                            <div className="flex items-start gap-3">
                              {/* Icône type */}
                              <div className={`flex h-8 w-8 items-center justify-center bg-slate-100 dark:bg-slate-800 shrink-0`}>
                                <Icon className={`h-4 w-4 ${config.color}`} />
                              </div>

                              {/* Contenu */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                                    {task.label}
                                  </span>
                                  {task.frequency && (
                                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">{task.frequency}</span>
                                  )}
                                  {task.priority === 'urgent' && (
                                    <span className="text-[9px] font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/60 px-1.5 py-0.5 border border-red-300 dark:border-red-800">URGENT</span>
                                  )}
                                </div>
                                {task.description && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{task.description}</p>
                                )}
                                {task.medicationDisplay && (
                                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                                    💊 {task.medicationDisplay} {task.dosage} — {task.route}
                                  </p>
                                )}

                                {/* Résultat si exécuté */}
                                {task.status === 'done' && task.result && (
                                  <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />
                                    <span>{task.result} — par {task.executedByName} à {new Date(task.executedAt || '').toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                )}
                                {task.status === 'skipped' && task.skipReason && (
                                  <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                                    <X className="h-3 w-3 shrink-0 mt-0.5" />
                                    <span>Non effectué : {task.skipReason} — par {task.executedByName}</span>
                                  </div>
                                )}
                              </div>

                              {/* Actions (si pending) */}
                              {task.status === 'pending' && !isExecuting && !isSkipping && !isAdministering && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {task.type === 'medication' && (
                                    <button
                                      onClick={() => setAdminTaskId(task.id)}
                                      className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 text-[10px] font-bold transition-colors"
                                      title="Enregistrer l'administration"
                                    >
                                      <Pill className="h-3 w-3" />
                                      Administrer
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setExecutingTaskId(task.id)}
                                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[10px] font-bold transition-colors"
                                    title="Marquer comme effectué"
                                  >
                                    <Check className="h-3 w-3" />
                                    Fait
                                  </button>
                                  <button
                                    onClick={() => setSkipTaskId(task.id)}
                                    className="flex items-center gap-1 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 px-2.5 py-1 text-[10px] font-bold transition-colors"
                                    title="Ignorer (motif obligatoire)"
                                  >
                                    <X className="h-3 w-3" />
                                    Ignorer
                                  </button>
                                </div>
                              )}

                              {/* Formulaire d'exécution */}
                              {isExecuting && (
                                <div className="w-full mt-2 space-y-2">
                                  <textarea
                                    value={taskResult}
                                    onChange={(e) => setTaskResult(e.target.value)}
                                    placeholder="Résultat / observation (ex: TA = 135/85, patient calme)"
                                    rows={2}
                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 focus:outline-none resize-none"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <button onClick={() => handleExecute(task.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 text-xs font-bold">✓ Confirmer</button>
                                    <button onClick={() => { setExecutingTaskId(null); setTaskResult(''); }} className="px-3 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 py-1.5 text-xs font-bold">Annuler</button>
                                  </div>
                                </div>
                              )}

                              {/* Formulaire d'administration */}
                              {isAdministering && (
                                <div className="w-full mt-2 space-y-2">
                                  <div className="p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300">
                                    💊 {task.medicationDisplay} {task.dosage} — Voie : {task.route}
                                  </div>
                                  <textarea
                                    value={adminEffect}
                                    onChange={(e) => setAdminEffect(e.target.value)}
                                    placeholder="Effet observé (ex: Douleur soulagée en 30min)"
                                    rows={2}
                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:outline-none resize-none"
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    value={adminSideEffects}
                                    onChange={(e) => setAdminSideEffects(e.target.value)}
                                    placeholder="Effets indésirables ? (laisser vide si aucun)"
                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-amber-500 focus:outline-none"
                                  />
                                  <div className="flex gap-2">
                                    <button onClick={() => handleRecordAdmin(task)} disabled={!adminEffect.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-1.5 text-xs font-bold">💊 Enregistrer</button>
                                    <button onClick={() => { setAdminTaskId(null); setAdminEffect(''); setAdminSideEffects(''); }} className="px-3 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 py-1.5 text-xs font-bold">Annuler</button>
                                  </div>
                                </div>
                              )}

                              {/* Formulaire de skip */}
                              {isSkipping && (
                                <div className="w-full mt-2 space-y-2">
                                  <textarea
                                    value={skipReason}
                                    onChange={(e) => setSkipReason(e.target.value)}
                                    placeholder="Motif de non-exécution (obligatoire)..."
                                    rows={2}
                                    className="w-full px-2.5 py-1.5 text-xs border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 focus:border-amber-500 focus:outline-none resize-none"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <button onClick={() => handleSkip(task.id)} disabled={!skipReason.trim()} className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white py-1.5 text-xs font-bold">Confirmer</button>
                                    <button onClick={() => { setSkipTaskId(null); setSkipReason(''); }} className="px-3 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 py-1.5 text-xs font-bold">Annuler</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Historique des administrations */}
                    {patientAdmins.length > 0 && (
                      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                          Historique des administrations
                        </div>
                        <div className="space-y-1.5">
                          {patientAdmins.slice(0, 5).map((admin) => (
                            <div key={admin.id} className="flex items-center gap-2 text-[11px]">
                              <span className="font-mono text-slate-400">{new Date(admin.administeredAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                              <Pill className="h-3 w-3 text-blue-500" />
                              <span className="font-bold text-slate-700 dark:text-slate-300">{admin.medicationDisplay} {admin.dosage}</span>
                              <span className="text-slate-500">— {admin.route}</span>
                              {admin.effectObserved && <span className="text-emerald-600 dark:text-emerald-400">✓ {admin.effectObserved}</span>}
                              {admin.sideEffects && <span className="text-amber-600 dark:text-amber-400">⚠ {admin.sideEffects}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

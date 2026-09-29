import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  Plus,
  Filter,
  Calendar,
} from 'lucide-react';
import { FollowUpTask, Patient, AppUser } from '../types/clinical';

interface FollowUpManagerProps {
  tasks: FollowUpTask[];
  patients: Patient[];
  currentUser: AppUser;
  onAddTask: (task: FollowUpTask) => void;
  onUpdateTaskStatus: (taskId: string, status: FollowUpTask['status']) => void;
}

export const FollowUpManager: React.FC<FollowUpManagerProps> = ({
  tasks,
  patients,
  currentUser,
  onAddTask,
  onUpdateTaskStatus,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [patientId, setPatientId] = useState(patients[0]?.id || '');
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [priority, setPriority] = useState<FollowUpTask['priority']>('routine');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [taskType, setTaskType] = useState<FollowUpTask['taskType']>('exam_control');

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === patientId);
    if (!pat || !title.trim()) return;

    const newTask: FollowUpTask = {
      id: `flw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      patientId: pat.id,
      patientName: `${pat.familyName} ${pat.givenName}`,
      assignedToId: currentUser.id,
      assignedToName: currentUser.displayName,
      taskType,
      title: title.trim(),
      objective: objective.trim() || 'Suivi clinique documenté',
      dueAt: `${dueDate}T12:00:00.000Z`,
      priority,
      status: 'pending',
    };

    onAddTask(newTask);
    setTitle('');
    setObjective('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Filters */}
      <div className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            File de Suivi Patient & Rappels Cliniques ({tasks.length})
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Coordination des contrôles biologiques, rappels téléphoniques et renouvellements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">Tous les états</option>
              <option value="pending">En attente</option>
              <option value="in_progress">En cours</option>
              <option value="overdue">En retard</option>
              <option value="done">Terminés</option>
            </select>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Nouveau rappel de suivi</span>
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-clinical">
            Aucune tâche de suivi correspondant à ce filtre.
          </div>
        ) : (
          filteredTasks.map((t) => {
            const isDone = t.status === 'done';
            const isOverdue = t.status === 'overdue';

            return (
              <div
                key={t.id}
                className={` border p-4 shadow-clinical transition-all flex flex-col justify-between ${
                  isOverdue
                    ? 'border-red-300 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/30'
                    : isDone
                    ? 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 opacity-75'
                    : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 ${
                        t.priority === 'urgent'
                          ? 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300'
                          : t.priority === 'important'
                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      {t.priority}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      Échéance : {new Date(t.dueAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.title}</h3>
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Patient : {t.patientName}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t.objective}
                  </p>
                  <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                    Assigné à : <span className="font-semibold text-slate-800 dark:text-slate-200">{t.assignedToName}</span>
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 capitalize">
                    {t.status === 'overdue' ? 'En retard' : t.status === 'done' ? 'Terminé' : 'En attente'}
                  </span>
                  {!isDone ? (
                    <button
                      onClick={() => onUpdateTaskStatus(t.id, 'done')}
                      className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Clôturer</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onUpdateTaskStatus(t.id, 'pending')}
                      className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                    >
                      Rouvrir
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal create task */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
              Programmer une tâche de suivi clinique
            </h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Patient
                </label>
                <select
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
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
                  Titre de la tâche
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Contrôle INR à J+15"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Objectif clinique
                </label>
                <textarea
                  rows={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Instructions spécifiques pour le praticien ou l'IDE..."
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date d'échéance
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priorité
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full border border-slate-300 dark:border-slate-700 p-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="routine">Routine</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                >
                  Créer le suivi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import { useState, useCallback, useMemo } from 'react';
import {
  NursingCarePlan,
  NursingTask,
  MedicationAdministration,
  Patient,
  AppUser,
} from '../types/clinical';

/**
 * useNursingCare — Gère le carnet de soins infirmier.
 *
 * Architecture :
 *  - carePlans : plans créés par les médecins (directives pour les infirmiers)
 *  - tasks : checklist de tâches à effectuer (vitals, meds, prélèvements, etc.)
 *  - administrations : enregistrement des médicaments administrés (MAR)
 *
 * Workflow :
 *  1. Médecin crée un plan → addCarePlan(patient, diagnosis, instructions, tasks)
 *  2. Infirmier voit les tâches pending → executeTask(taskId, result)
 *  3. Infirmier administre un médicament → recordAdministration(admin)
 *  4. Médecin consulte l'avancement → getPlanProgress(carePlanId)
 *
 * Le hook gère aussi les notifications (le médecin est notifié quand une tâche est faite).
 */

interface UseNursingCareOptions {
  currentUser: AppUser;
  onAudit?: (action: string, resourceType: string, details: {
    resourceId?: string;
    patientId?: string;
    patientName?: string;
    outcome?: 'allowed' | 'denied' | 'challenged';
    reasonText?: string;
  }) => void;
}

interface NursingCareState {
  // Données
  carePlans: NursingCarePlan[];
  tasks: NursingTask[];
  administrations: MedicationAdministration[];

  // Plans
  addCarePlan: (patient: Patient, diagnosis: string, instructions: string, taskTemplates: TaskTemplate[], assignedNurse?: AppUser) => string;
  updateCarePlanStatus: (planId: string, status: NursingCarePlan['status']) => void;
  getCarePlansForPatient: (patientId: string) => NursingCarePlan[];
  getActiveCarePlans: () => NursingCarePlan[];

  // Tâches
  getTasksForPlan: (carePlanId: string) => NursingTask[];
  getTasksForPatient: (patientId: string) => NursingTask[];
  executeTask: (taskId: string, result: string) => void;
  skipTask: (taskId: string, reason: string) => void;
  getPlanProgress: (carePlanId: string) => { total: number; done: number; pending: number; skipped: number; percentage: number };

  // Administrations
  recordAdministration: (admin: Omit<MedicationAdministration, 'id' | 'administeredBy' | 'administeredByName' | 'administeredAt'>) => void;
  getAdministrationsForPatient: (patientId: string) => MedicationAdministration[];
}

// Template de tâche (utilisé par le médecin pour créer un plan)
export interface TaskTemplate {
  type: NursingTask['type'];
  label: string;
  description?: string;
  medicationDisplay?: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  priority?: NursingTask['priority'];
}

export function useNursingCare({ currentUser, onAudit }: UseNursingCareOptions): NursingCareState {
  const [carePlans, setCarePlans] = useState<NursingCarePlan[]>([]);
  const [tasks, setTasks] = useState<NursingTask[]>([]);
  const [administrations, setAdministrations] = useState<MedicationAdministration[]>([]);

  // === PLANS ===
  const addCarePlan = useCallback((
    patient: Patient,
    diagnosis: string,
    instructions: string,
    taskTemplates: TaskTemplate[],
    assignedNurse?: AppUser
  ): string => {
    const planId = `ncp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const plan: NursingCarePlan = {
      id: planId,
      patientId: patient.id,
      patientName: `${patient.familyName} ${patient.givenName}`,
      prescribedBy: currentUser.id,
      prescribedByName: currentUser.displayName,
      prescribedAt: now,
      assignedToNurseId: assignedNurse?.id,
      assignedToNurseName: assignedNurse?.displayName,
      diagnosis,
      instructions,
      status: 'active',
      startDate: now,
      priority: 'routine',
    };

    setCarePlans((prev) => [...prev, plan]);

    // Créer les tâches à partir des templates
    const newTasks: NursingTask[] = taskTemplates.map((tmpl) => ({
      id: `ntask_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${Math.random().toString(36).substring(2, 4)}`,
      carePlanId: planId,
      patientId: patient.id,
      type: tmpl.type,
      label: tmpl.label,
      description: tmpl.description,
      medicationDisplay: tmpl.medicationDisplay,
      dosage: tmpl.dosage,
      route: tmpl.route,
      frequency: tmpl.frequency,
      status: 'pending',
      priority: tmpl.priority || 'routine',
    }));

    setTasks((prev) => [...prev, ...newTasks]);

    onAudit?.('NURSING_CARE_PLAN_CREATE', 'nursing_care_plan', {
      resourceId: planId,
      patientId: patient.id,
      patientName: `${patient.familyName} ${patient.givenName}`,
      reasonText: `Plan de soins créé pour "${diagnosis}" — ${taskTemplates.length} tâche(s) prescrite(s)`,
    });

    return planId;
  }, [currentUser, onAudit]);

  const updateCarePlanStatus = useCallback((planId: string, status: NursingCarePlan['status']) => {
    setCarePlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? { ...p, status, endDate: status === 'completed' ? new Date().toISOString() : p.endDate }
          : p
      )
    );
    onAudit?.('NURSING_CARE_PLAN_STATUS', 'nursing_care_plan', {
      resourceId: planId,
      reasonText: `Plan de soins ${status}`,
    });
  }, [onAudit]);

  const getCarePlansForPatient = useCallback((patientId: string) => {
    return carePlans.filter((p) => p.patientId === patientId);
  }, [carePlans]);

  const getActiveCarePlans = useCallback(() => {
    return carePlans.filter((p) => p.status === 'active');
  }, [carePlans]);

  // === TÂCHES ===
  const getTasksForPlan = useCallback((carePlanId: string) => {
    return tasks.filter((t) => t.carePlanId === carePlanId);
  }, [tasks]);

  const getTasksForPatient = useCallback((patientId: string) => {
    return tasks.filter((t) => t.patientId === patientId);
  }, [tasks]);

  const executeTask = useCallback((taskId: string, result: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: 'done',
              executedBy: currentUser.id,
              executedByName: currentUser.displayName,
              executedAt: new Date().toISOString(),
              result,
            }
          : t
      )
    );

    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      onAudit?.('NURSING_TASK_EXECUTE', 'nursing_task', {
        resourceId: taskId,
        patientId: task.patientId,
        reasonText: `Tâche "${task.label}" effectuée par ${currentUser.displayName} — Résultat : ${result}`,
      });
    }
  }, [currentUser, tasks, onAudit]);

  const skipTask = useCallback((taskId: string, reason: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: 'skipped',
              executedBy: currentUser.id,
              executedByName: currentUser.displayName,
              executedAt: new Date().toISOString(),
              skipReason: reason,
            }
          : t
      )
    );

    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      onAudit?.('NURSING_TASK_SKIP', 'nursing_task', {
        resourceId: taskId,
        patientId: task.patientId,
        reasonText: `Tâche "${task.label}" non effectuée — Motif : ${reason}`,
      });
    }
  }, [currentUser, tasks, onAudit]);

  const getPlanProgress = useCallback((carePlanId: string) => {
    const planTasks = tasks.filter((t) => t.carePlanId === carePlanId);
    const total = planTasks.length;
    const done = planTasks.filter((t) => t.status === 'done').length;
    const skipped = planTasks.filter((t) => t.status === 'skipped').length;
    const pending = planTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pending, skipped, percentage };
  }, [tasks]);

  // === ADMINISTRATIONS ===
  const recordAdministration = useCallback((
    admin: Omit<MedicationAdministration, 'id' | 'administeredBy' | 'administeredByName' | 'administeredAt'>
  ) => {
    const fullAdmin: MedicationAdministration = {
      ...admin,
      id: `mar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      administeredBy: currentUser.id,
      administeredByName: currentUser.displayName,
      administeredAt: new Date().toISOString(),
    };

    setAdministrations((prev) => [...prev, fullAdmin]);

    // Si lié à une tâche, marquer la tâche comme faite
    if (fullAdmin.taskId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === fullAdmin.taskId
            ? {
                ...t,
                status: 'done',
                executedBy: currentUser.id,
                executedByName: currentUser.displayName,
                executedAt: new Date().toISOString(),
                result: `Administré : ${fullAdmin.dosage} ${fullAdmin.route}${fullAdmin.effectObserved ? ` — Effet : ${fullAdmin.effectObserved}` : ''}`,
              }
            : t
        )
      );
    }

    onAudit?.('MEDICATION_ADMINISTRATION', 'medication_administration', {
      resourceId: fullAdmin.id,
      patientId: admin.patientId,
      patientName: admin.patientName,
      reasonText: `${admin.medicationDisplay} ${admin.dosage} ${admin.route} administré par ${currentUser.displayName}${admin.effectObserved ? ` — Effet : ${admin.effectObserved}` : ''}${admin.sideEffects ? ` — Effet indésirable : ${admin.sideEffects}` : ''}`,
    });
  }, [currentUser, onAudit]);

  const getAdministrationsForPatient = useCallback((patientId: string) => {
    return administrations
      .filter((a) => a.patientId === patientId)
      .sort((a, b) => new Date(b.administeredAt).getTime() - new Date(a.administeredAt).getTime());
  }, [administrations]);

  return {
    carePlans,
    tasks,
    administrations,
    addCarePlan,
    updateCarePlanStatus,
    getCarePlansForPatient,
    getActiveCarePlans,
    getTasksForPlan,
    getTasksForPatient,
    executeTask,
    skipTask,
    getPlanProgress,
    recordAdministration,
    getAdministrationsForPatient,
  };
}

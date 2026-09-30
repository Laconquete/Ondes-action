import { create } from 'zustand';
import {
  Patient,
  Appointment,
  ClinicalNote,
  ClinicalAddendum,
  MedicationOrder,
  FollowUpTask,
  SecureConversation,
  SecureMessage,
  QueueTicket,
  DoctorNotification,
  OutboxItem,
} from '../types/clinical';
import { db } from '../services/localDatabase';
import { generateSecureId } from '../services/cryptoAuditService';

/**
 * Store central des données cliniques.
 *
 * Remplace les 20 useState dispersés dans App.tsx (836 lignes → ~100 lignes après refactor).
 *
 * Persistance :
 *  - Toutes les mutations sont écrites en local (Dexie/IndexedDB) en premier
 *  - Une entrée outbox est créée pour chaque mutation, pour sync Supabase
 *  - Le state React est mis à jour après l'écriture locale (optimistic UI)
 *
 * Pattern : pour chaque mutation :
 *   1. db.[table].add/update (local-first)
 *   2. db.outboxItems.add (pour sync)
 *   3. set() Zustand (update UI)
 */

interface ClinicalState {
  // Données cliniques
  patients: Patient[];
  appointments: Appointment[];
  clinicalNotes: Record<string, ClinicalNote>;
  addenda: ClinicalAddendum[];
  activeOrders: MedicationOrder[];
  followUps: FollowUpTask[];
  conversations: SecureConversation[];
  messages: Record<string, SecureMessage[]>;
  queueTickets: QueueTicket[];
  notifications: DoctorNotification[];
  outbox: OutboxItem[];

  // État UI
  activePatientId: string | null;
  activeTab: 'portal' | 'workspace' | 'schedule' | 'patients' | 'followups' | 'messaging' | 'audit';
  isLoading: boolean;

  // Actions — Patients
  loadPatients: (tenantId: string) => Promise<void>;
  selectPatient: (patientId: string) => void;
  addPatient: (patient: Patient, tenantId: string) => Promise<void>;
  updatePatient: (patientId: string, updates: Partial<Patient>, tenantId: string) => Promise<void>;
  updatePatientDoctor: (patientId: string, doctorId: string, doctorName: string, tenantId: string) => Promise<void>;

  // Actions — Notes cliniques
  saveNoteDraft: (note: ClinicalNote, tenantId: string) => Promise<void>;
  signNote: (note: ClinicalNote, tenantId: string) => Promise<void>;
  addAddendum: (addendum: Omit<ClinicalAddendum, 'id' | 'authoredAt'>, tenantId: string) => Promise<void>;

  // Actions — Prescriptions
  addMedicationOrder: (order: MedicationOrder, tenantId: string) => Promise<void>;

  // Actions — RDV
  loadAppointments: (tenantId: string) => Promise<void>;
  addAppointment: (appointment: Appointment, tenantId: string) => Promise<void>;
  updateAppointment: (appointmentId: string, updates: Partial<Appointment>, tenantId: string) => Promise<void>;

  // Actions — Notifications
  addNotification: (notif: DoctorNotification) => void;
  markNotificationRead: (notifId: string) => void;

  // Actions — File d'attente
  callNextPatient: (queueId: string) => Promise<void>;

  // Actions — UI
  setActiveTab: (tab: ClinicalState['activeTab']) => void;

  // Actions — Outbox / sync
  loadOutbox: (tenantId: string) => Promise<void>;
  clearAppliedOutbox: (tenantId: string) => Promise<void>;
}

export const useClinicalStore = create<ClinicalState>((set, get) => ({
  patients: [],
  appointments: [],
  clinicalNotes: {},
  addenda: [],
  activeOrders: [],
  followUps: [],
  conversations: [],
  messages: {},
  queueTickets: [],
  notifications: [],
  outbox: [],
  activePatientId: null,
  activeTab: 'portal',
  isLoading: false,

  loadPatients: async (tenantId) => {
    const patients = await db.patients.where('tenantId').equals(tenantId).toArray();
    set({ patients: patients.map((p) => ({ ...p, tenantId: undefined }) as Patient) });
  },

  selectPatient: (patientId) => {
    set({ activePatientId: patientId });
  },

  addPatient: async (patient, tenantId) => {
    const patientWithTenant = { ...patient, tenantId };
    await db.patients.add(patientWithTenant);
    await db.outboxItems.add({
      id: generateSecureId('out'),
      tenantId,
      aggregateType: 'patient',
      aggregateId: patient.id,
      operationType: 'INSERT',
      payload: patient as unknown as Record<string, unknown>,
      baseVersion: 1,
      idempotencyKey: generateSecureId('idemp'),
      createdAt: new Date().toISOString(),
      status: 'applied',
    });
    set((state) => ({ patients: [...state.patients, patient] }));
  },

  updatePatient: async (patientId, updates, tenantId) => {
    const existing = await db.patients.get(patientId);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    await db.patients.put(updated);
    await db.outboxItems.add({
      id: generateSecureId('out'),
      tenantId,
      aggregateType: 'patient',
      aggregateId: patientId,
      operationType: 'UPDATE',
      payload: updates as Record<string, unknown>,
      baseVersion: 1,
      idempotencyKey: generateSecureId('idemp'),
      createdAt: new Date().toISOString(),
      status: 'applied',
    });
    set((state) => ({
      patients: state.patients.map((p) => (p.id === patientId ? { ...p, ...updates } : p)),
    }));
  },

  updatePatientDoctor: async (patientId, doctorId, doctorName, tenantId) => {
    await get().updatePatient(patientId, {
      primaryDoctorId: doctorId,
      primaryDoctorName: doctorName,
    }, tenantId);
  },

  saveNoteDraft: async (note, tenantId) => {
    const noteWithTenant = { ...note, tenantId };
    await db.clinicalNotes.put(noteWithTenant);
    await db.outboxItems.add({
      id: generateSecureId('out'),
      tenantId,
      aggregateType: 'clinical_note',
      aggregateId: note.id,
      operationType: 'UPDATE',
      payload: note as unknown as Record<string, unknown>,
      baseVersion: 1,
      idempotencyKey: generateSecureId('idemp'),
      createdAt: new Date().toISOString(),
      status: 'applied',
    });
    set((state) => ({
      clinicalNotes: { ...state.clinicalNotes, [note.patientId]: note },
    }));
  },

  signNote: async (note, tenantId) => {
    const signedNote: ClinicalNote = {
      ...note,
      status: 'signed',
      signedAt: new Date().toISOString(),
    };
    await get().saveNoteDraft(signedNote, tenantId);
  },

  addAddendum: async (addendum, tenantId) => {
    const fullAddendum: ClinicalAddendum = {
      ...addendum,
      id: generateSecureId('add'),
      authoredAt: new Date().toISOString(),
    };
    await db.clinicalAddenda.add({ ...fullAddendum, tenantId });
    await db.outboxItems.add({
      id: generateSecureId('out'),
      tenantId,
      aggregateType: 'clinical_addendum',
      aggregateId: fullAddendum.id,
      operationType: 'INSERT',
      payload: fullAddendum as unknown as Record<string, unknown>,
      baseVersion: 1,
      idempotencyKey: generateSecureId('idemp'),
      createdAt: new Date().toISOString(),
      status: 'applied',
    });
    set((state) => ({ addenda: [...state.addenda, fullAddendum] }));
  },

  addMedicationOrder: async (order, tenantId) => {
    const orderWithTenant = { ...order, tenantId };
    await db.medicationOrders.add(orderWithTenant);
    await db.outboxItems.add({
      id: generateSecureId('out'),
      tenantId,
      aggregateType: 'medication_order',
      aggregateId: order.id,
      operationType: 'INSERT',
      payload: order as unknown as Record<string, unknown>,
      baseVersion: 1,
      idempotencyKey: generateSecureId('idemp'),
      createdAt: new Date().toISOString(),
      status: 'applied',
    });
    set((state) => ({ activeOrders: [...state.activeOrders, order] }));
  },

  loadAppointments: async (tenantId) => {
    const appts = await db.appointments.where('tenantId').equals(tenantId).toArray();
    set({ appointments: appts.map((a) => ({ ...a, tenantId: undefined }) as Appointment) });
  },

  addAppointment: async (appointment, tenantId) => {
    const apptWithTenant = { ...appointment, tenantId };
    await db.appointments.add(apptWithTenant);
    await db.outboxItems.add({
      id: generateSecureId('out'),
      tenantId,
      aggregateType: 'appointment',
      aggregateId: appointment.id,
      operationType: 'INSERT',
      payload: appointment as unknown as Record<string, unknown>,
      baseVersion: 1,
      idempotencyKey: generateSecureId('idemp'),
      createdAt: new Date().toISOString(),
      status: 'applied',
    });
    set((state) => ({ appointments: [...state.appointments, appointment] }));
  },

  updateAppointment: async (appointmentId, updates, tenantId) => {
    const existing = await db.appointments.get(appointmentId);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    await db.appointments.put(updated);
    await db.outboxItems.add({
      id: generateSecureId('out'),
      tenantId,
      aggregateType: 'appointment',
      aggregateId: appointmentId,
      operationType: 'UPDATE',
      payload: updates as Record<string, unknown>,
      baseVersion: 1,
      idempotencyKey: generateSecureId('idemp'),
      createdAt: new Date().toISOString(),
      status: 'applied',
    });
    set((state) => ({
      appointments: state.appointments.map((a) => (a.id === appointmentId ? { ...a, ...updates } : a)),
    }));
  },

  addNotification: (notif) => {
    set((state) => ({ notifications: [notif, ...state.notifications] }));
  },

  markNotificationRead: (notifId) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === notifId ? { ...n, read: true } : n)),
    }));
  },

  callNextPatient: async (queueId) => {
    set((state) => ({
      queueTickets: state.queueTickets.map((q) =>
        q.id === queueId ? { ...q, status: 'in_room' as const } : q
      ),
    }));
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadOutbox: async (tenantId) => {
    const outbox = await db.outboxItems.where('tenantId').equals(tenantId).toArray();
    set({ outbox: outbox.map((o) => ({ ...o, tenantId: undefined }) as OutboxItem) });
  },

  clearAppliedOutbox: async (tenantId) => {
    await db.outboxItems
      .where('[tenantId+status]')
      .equals([tenantId, 'applied'])
      .delete();
    await get().loadOutbox(tenantId);
  },
}));

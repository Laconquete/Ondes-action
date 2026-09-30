import { useState, useCallback } from 'react';
import {
  Patient,
  ClinicalNote,
  ClinicalAddendum,
  MedicationOrder,
  FollowUpTask,
  SecureConversation,
  SecureMessage,
  Appointment,
  QueueTicket,
  DoctorNotification,
} from '../types/clinical';
import {
  INITIAL_PATIENTS,
  INITIAL_CLINICAL_NOTES,
  INITIAL_ACTIVE_ORDERS,
  INITIAL_FOLLOW_UPS,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
  INITIAL_APPOINTMENTS,
  INITIAL_QUEUE_TICKETS,
} from '../services/mockData';

/**
 * usePatientData — Centralise toutes les données cliniques + leurs mutateurs.
 *
 * Extrait de App.tsx pour réduire les ~12 useState dispersés en un seul hook cohérent.
 * Les handlers retournés effectuent les mutations + déclenchent l'audit (via callback externe).
 *
 * Architecture :
 *  - State local (React useState) pour la réactivité UI
 *  - Les mutations sont synchrones (optimistic UI)
 *  - L'audit + l'outbox sont gérés par le caller (App.tsx) via les callbacks
 */

interface UsePatientDataOptions {
  onAudit?: (action: string, resourceType: string, details: {
    resourceId?: string;
    patientId?: string;
    patientName?: string;
    outcome?: 'allowed' | 'denied' | 'challenged';
    reasonText?: string;
  }) => void;
  onQueueOutbox?: (aggregateType: string, aggregateId: string, operationType: string, payload: Record<string, unknown>) => void;
}

interface PatientDataState {
  // Données
  patients: Patient[];
  appointments: Appointment[];
  queueTickets: QueueTicket[];
  clinicalNotes: Record<string, ClinicalNote>;
  addenda: ClinicalAddendum[];
  activeOrders: MedicationOrder[];
  followUps: FollowUpTask[];
  conversations: SecureConversation[];
  messages: Record<string, SecureMessage[]>;
  notifications: DoctorNotification[];

  // Active patient
  activePatientId: string;
  setActivePatientId: (id: string) => void;

  // Mutateurs
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  setQueueTickets: React.Dispatch<React.SetStateAction<QueueTicket[]>>;
  setClinicalNotes: React.Dispatch<React.SetStateAction<Record<string, ClinicalNote>>>;
  setAddenda: React.Dispatch<React.SetStateAction<ClinicalAddendum[]>>;
  setActiveOrders: React.Dispatch<React.SetStateAction<MedicationOrder[]>>;
  setFollowUps: React.Dispatch<React.SetStateAction<FollowUpTask[]>>;
  setConversations: React.Dispatch<React.SetStateAction<SecureConversation[]>>;
  setMessages: React.Dispatch<React.SetStateAction<Record<string, SecureMessage[]>>>;
  setNotifications: React.Dispatch<React.SetStateAction<DoctorNotification[]>>;

  // Handlers métier
  addPatient: (patient: Patient) => void;
  updatePatient: (patientId: string, updates: Partial<Patient>) => void;
  updatePatientDoctor: (patientId: string, doctorId: string, doctorName: string) => void;
  saveNoteDraft: (note: ClinicalNote) => void;
  signNote: (note: ClinicalNote) => void;
  addAddendum: (addendum: Omit<ClinicalAddendum, 'id' | 'authoredAt'>) => void;
  addMedicationOrder: (order: MedicationOrder) => void;
  addAppointment: (appt: Appointment) => void;
  updateAppointmentStatus: (appointmentId: string, status: Appointment['status']) => void;
  callQueueTicket: (ticketId: string) => void;
  sendMessage: (conversationId: string, text: string, senderId: string, senderName: string) => void;
  addFollowUpTask: (task: FollowUpTask) => void;
  updateFollowUpStatus: (taskId: string, status: FollowUpTask['status']) => void;
  convertToFollowUp: (taskId: string, convertedBy: string) => void;
  addNotification: (notif: DoctorNotification) => void;
}

export function usePatientData(options: UsePatientDataOptions = {}): PatientDataState {
  const { onAudit, onQueueOutbox } = options;

  // State local — initialisé depuis mockData
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [activePatientId, setActivePatientId] = useState<string>(INITIAL_PATIENTS[0].id);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [queueTickets, setQueueTickets] = useState<QueueTicket[]>(INITIAL_QUEUE_TICKETS);
  const [clinicalNotes, setClinicalNotes] = useState<Record<string, ClinicalNote>>({
    [INITIAL_PATIENTS[0].id]: INITIAL_CLINICAL_NOTES[0],
  });
  const [addenda, setAddenda] = useState<ClinicalAddendum[]>([]);
  const [activeOrders, setActiveOrders] = useState<MedicationOrder[]>(INITIAL_ACTIVE_ORDERS);
  const [followUps, setFollowUps] = useState<FollowUpTask[]>(INITIAL_FOLLOW_UPS);
  const [conversations, setConversations] = useState<SecureConversation[]>(INITIAL_CONVERSATIONS);
  const [messages, setMessages] = useState<Record<string, SecureMessage[]>>(INITIAL_MESSAGES);
  const [notifications, setNotifications] = useState<DoctorNotification[]>([]);

  // Handlers métier
  const addPatient = useCallback((patient: Patient) => {
    setPatients((prev) => [patient, ...prev]);
    onAudit?.('PATIENT_CREATE', 'patient', {
      resourceId: patient.id,
      patientId: patient.id,
      patientName: `${patient.familyName} ${patient.givenName}`,
      reasonText: `Création du dossier patient ${patient.medicalRecordNumber}`,
    });
    onQueueOutbox?.('patient', patient.id, 'INSERT', patient as unknown as Record<string, unknown>);
  }, [onAudit, onQueueOutbox]);

  const updatePatient = useCallback((patientId: string, updates: Partial<Patient>) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, ...updates } : p))
    );
    onQueueOutbox?.('patient', patientId, 'UPDATE', updates as Record<string, unknown>);
  }, [onQueueOutbox]);

  const updatePatientDoctor = useCallback((patientId: string, doctorId: string, doctorName: string) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? { ...p, primaryDoctorId: doctorId, primaryDoctorName: doctorName }
          : p
      )
    );
    onAudit?.('PATIENT_ASSIGN_DOCTOR', 'patient', {
      resourceId: patientId,
      patientId,
      reasonText: `Attribution du médecin traitant référent à : ${doctorName}`,
    });
    onQueueOutbox?.('patient', patientId, 'UPDATE', { primaryDoctorId: doctorId, primaryDoctorName: doctorName });
  }, [onAudit, onQueueOutbox]);

  const saveNoteDraft = useCallback((note: ClinicalNote) => {
    setClinicalNotes((prev) => ({ ...prev, [note.patientId]: note }));
    onQueueOutbox?.('clinical_note', note.id, 'UPDATE', note as unknown as Record<string, unknown>);
  }, [onQueueOutbox]);

  const signNote = useCallback((note: ClinicalNote) => {
    const signedNote: ClinicalNote = {
      ...note,
      status: 'signed',
      signedAt: new Date().toISOString(),
    };
    setClinicalNotes((prev) => ({ ...prev, [note.patientId]: signedNote }));
    onAudit?.('CLINICAL_NOTE_SIGN', 'clinical_note', {
      resourceId: note.id,
      patientId: note.patientId,
      reasonText: `Signature électronique de la note SOAP (version ${note.noteVersion})`,
    });
    onQueueOutbox?.('clinical_note', note.id, 'UPDATE', signedNote as unknown as Record<string, unknown>);
  }, [onAudit, onQueueOutbox]);

  const addAddendum = useCallback((addendumData: Omit<ClinicalAddendum, 'id' | 'authoredAt'>) => {
    const fullAddendum: ClinicalAddendum = {
      ...addendumData,
      id: `add_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      authoredAt: new Date().toISOString(),
    };
    setAddenda((prev) => [...prev, fullAddendum]);
    onAudit?.('CLINICAL_ADDENDUM_CREATE', 'clinical_addendum', {
      resourceId: fullAddendum.id,
      reasonText: `Ajout d'un addendum : ${addendumData.reason}`,
    });
    onQueueOutbox?.('clinical_addendum', fullAddendum.id, 'INSERT', fullAddendum as unknown as Record<string, unknown>);
  }, [onAudit, onQueueOutbox]);

  const addMedicationOrder = useCallback((order: MedicationOrder) => {
    setActiveOrders((prev) => [...prev, order]);
    onAudit?.('PRESCRIPTION_CREATE', 'medication_order', {
      resourceId: order.id,
      patientId: order.patientId,
      reasonText: `Prescription de ${order.medicationDisplay} (${order.dosage}, ${order.frequency})`,
    });
    onQueueOutbox?.('medication_order', order.id, 'INSERT', order as unknown as Record<string, unknown>);
  }, [onAudit, onQueueOutbox]);

  const addAppointment = useCallback((appt: Appointment) => {
    setAppointments((prev) => [...prev, appt]);
    onAudit?.('APPOINTMENT_CREATE', 'appointment', {
      resourceId: appt.id,
      patientId: appt.patientId,
      patientName: appt.patientName,
      reasonText: `RDV programmé le ${new Date(appt.startsAt).toLocaleString('fr-FR')} avec ${appt.practitionerName}`,
    });
    onQueueOutbox?.('appointment', appt.id, 'INSERT', appt as unknown as Record<string, unknown>);
  }, [onAudit, onQueueOutbox]);

  const updateAppointmentStatus = useCallback((appointmentId: string, status: Appointment['status']) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status } : a))
    );
    onAudit?.('APPOINTMENT_STATUS_CHANGE', 'appointment', {
      resourceId: appointmentId,
      reasonText: `Statut du RDV modifié en : ${status}`,
    });
    onQueueOutbox?.('appointment', appointmentId, 'UPDATE', { status });
  }, [onAudit, onQueueOutbox]);

  const callQueueTicket = useCallback((ticketId: string) => {
    setQueueTickets((prev) =>
      prev.map((q) =>
        q.id === ticketId ? { ...q, status: 'in_room' as const, calledAt: new Date().toISOString() } : q
      )
    );
    onAudit?.('QUEUE_CALL_PATIENT', 'queue_ticket', {
      resourceId: ticketId,
      reasonText: 'Appel du patient en salle de consultation',
    });
  }, [onAudit]);

  const sendMessage = useCallback((conversationId: string, text: string, senderId: string, senderName: string) => {
    const newMessage: SecureMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      conversationId,
      senderType: 'doctor',
      senderName,
      body: text,
      sentAt: new Date().toISOString(),
      status: 'sent',
      idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setMessages((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMessage],
    }));
    onAudit?.('MESSAGE_SEND', 'secure_message', {
      resourceId: newMessage.id,
      reasonText: `Message sécurisé MSSanté envoyé dans la conversation ${conversationId}`,
    });
    onQueueOutbox?.('secure_message', newMessage.id, 'INSERT', newMessage as unknown as Record<string, unknown>);
  }, [onAudit, onQueueOutbox]);

  const addFollowUpTask = useCallback((task: FollowUpTask) => {
    setFollowUps((prev) => [...prev, task]);
    onAudit?.('FOLLOWUP_CREATE', 'follow_up_task', {
      resourceId: task.id,
      patientId: task.patientId,
      reasonText: `Tâche de suivi créée : ${task.taskType}`,
    });
    onQueueOutbox?.('follow_up_task', task.id, 'INSERT', task as unknown as Record<string, unknown>);
  }, [onAudit, onQueueOutbox]);

  const updateFollowUpStatus = useCallback((taskId: string, status: FollowUpTask['status']) => {
    setFollowUps((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
    onAudit?.('FOLLOWUP_STATUS_CHANGE', 'follow_up_task', {
      resourceId: taskId,
      reasonText: `Statut du suivi modifié en : ${status}`,
    });
    onQueueOutbox?.('follow_up_task', taskId, 'UPDATE', { status });
  }, [onAudit, onQueueOutbox]);

  const convertToFollowUp = useCallback((taskId: string, convertedBy: string) => {
    onAudit?.('FOLLOWUP_CONVERT', 'follow_up_task', {
      resourceId: taskId,
      reasonText: `Conversion en RDV de suivi par ${convertedBy}`,
    });
  }, [onAudit]);

  const addNotification = useCallback((notif: DoctorNotification) => {
    setNotifications((prev) => [notif, ...prev]);
  }, []);

  return {
    patients,
    appointments,
    queueTickets,
    clinicalNotes,
    addenda,
    activeOrders,
    followUps,
    conversations,
    messages,
    notifications,
    activePatientId,
    setActivePatientId,
    setPatients,
    setAppointments,
    setQueueTickets,
    setClinicalNotes,
    setAddenda,
    setActiveOrders,
    setFollowUps,
    setConversations,
    setMessages,
    setNotifications,
    addPatient,
    updatePatient,
    updatePatientDoctor,
    saveNoteDraft,
    signNote,
    addAddendum,
    addMedicationOrder,
    addAppointment,
    updateAppointmentStatus,
    callQueueTicket,
    sendMessage,
    addFollowUpTask,
    updateFollowUpStatus,
    convertToFollowUp,
    addNotification,
  };
}

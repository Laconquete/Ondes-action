import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  INITIAL_USERS,
  INITIAL_PATIENTS,
  INITIAL_MEDICATIONS,
  INITIAL_ACTIVE_ORDERS,
  INITIAL_APPOINTMENTS,
  INITIAL_QUEUE_TICKETS,
  INITIAL_CLINICAL_NOTES,
  INITIAL_FOLLOW_UPS,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
  INITIAL_AUDIT_TRAIL,
} from './services/mockData';
import {
  AppUser,
  Patient,
  Appointment,
  QueueTicket,
  ClinicalNote,
  ClinicalAddendum,
  MedicationOrder,
  FollowUpTask,
  SecureConversation,
  SecureMessage,
  AuditEvent,
  OutboxItem,
  BreakGlassEvent,
} from './types/clinical';
import { evaluateUserPermissions } from './services/clinicalEngine';
import { Header } from './components/Header';
import { DoctorPortalView } from './components/DoctorPortalView';
import { DoctorWorkspace } from './components/DoctorWorkspace';
import { DoctorSchedule } from './components/DoctorSchedule';
import { PatientListAndDetail } from './components/PatientListAndDetail';
import { PrescriptionSafetyModal } from './components/PrescriptionSafetyModal';
import { SecureMessagingView } from './components/SecureMessagingView';
import { FollowUpManager } from './components/FollowUpManager';
import { AuditTrailView } from './components/AuditTrailView';
import { BreakGlassModal } from './components/BreakGlassModal';
import { PatientSearchModal } from './components/PatientSearchModal';
import { OfflineSyncModal } from './components/OfflineSyncModal';

export default function App() {
  // Current user & authentication
  const [currentUser, setCurrentUser] = useState<AppUser>(INITIAL_USERS[0]);
  const [allUsers] = useState<AppUser[]>(INITIAL_USERS);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    'portal' | 'workspace' | 'schedule' | 'patients' | 'followups' | 'messaging' | 'audit'
  >('portal');

  // Network & Outbox
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toISOString());

  // Break-Glass state
  const [activeBreakGlass, setActiveBreakGlass] = useState<BreakGlassEvent | null>(null);

  // Modals
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isBreakGlassModalOpen, setIsBreakGlassModalOpen] = useState(false);

  // Clinical records state
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
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(INITIAL_AUDIT_TRAIL);

  // Active patient object
  const activePatient = useMemo(() => {
    return patients.find((p) => p.id === activePatientId) || patients[0];
  }, [patients, activePatientId]);

  // Active clinical note for the selected patient
  const activeNote = useMemo(() => {
    if (clinicalNotes[activePatient.id]) {
      return clinicalNotes[activePatient.id];
    }
    // Create blank SOAP draft if not existing yet
    return {
      id: `note_${activePatient.id}`,
      encounterId: `enc_${Date.now()}`,
      patientId: activePatient.id,
      subjective: {
        chiefComplaint: '',
        historyOfPresentIllness: '',
        symptoms: [],
      },
      objective: {
        physicalExam: '',
        vitalsRecorded: activePatient.vitalsHistory[0],
      },
      assessment: {
        diagnoses: [],
        clinicalEvaluation: '',
      },
      plan: {
        treatmentPlan: '',
        patientAdvice: '',
      },
      followUp: {},
      noteVersion: 1,
      authoredBy: currentUser.id,
      authoredByName: currentUser.displayName,
      authoredAt: new Date().toISOString(),
      status: 'draft' as const,
    };
  }, [clinicalNotes, activePatient, currentUser]);

  // Active patient's medications
  const patientActiveMedications = useMemo(() => {
    return activeOrders.filter(
      (o) => o.patientId === activePatient.id && o.status === 'active'
    );
  }, [activeOrders, activePatient.id]);

  // Permission evaluation based on RBAC & Break-Glass
  const isBreakGlassActive = !!(
    activeBreakGlass?.active && new Date(activeBreakGlass.expiresAt) > new Date()
  );

  const permissions = useMemo(() => {
    return evaluateUserPermissions(currentUser.role, isBreakGlassActive);
  }, [currentUser.role, isBreakGlassActive]);

  // Append immutable audit log helper
  const logAudit = useCallback(
    (
      action: string,
      resourceType: string,
      details: {
        resourceId?: string;
        patientId?: string;
        patientName?: string;
        outcome?: 'allowed' | 'denied' | 'challenged';
        reasonText?: string;
      } = {}
    ) => {
      const now = new Date().toISOString();
      const rawString = `${now}:${currentUser.id}:${action}:${details.resourceId || ''}:${details.patientId || ''}`;
      // Simple deterministic hash calculation for client audit trail demo
      let hash = 0;
      for (let i = 0; i < rawString.length; i++) {
        hash = (hash << 5) - hash + rawString.charCodeAt(i);
        hash |= 0;
      }
      const eventHash = `sha256_${Math.abs(hash).toString(16).padStart(12, '0')}`;

      const newEvent: AuditEvent = {
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        occurredAt: now,
        actorUserId: currentUser.id,
        actorName: currentUser.displayName,
        actorRole: currentUser.role,
        action,
        resourceType,
        resourceId: details.resourceId,
        patientId: details.patientId,
        patientName: details.patientName,
        outcome: details.outcome || 'allowed',
        reasonText: details.reasonText,
        eventHash,
      };

      setAuditEvents((prev) => [newEvent, ...prev]);
    },
    [currentUser]
  );

  // Queue mutation to outbox when offline or simulating offline sync
  const queueOutbox = useCallback(
    (aggregateType: string, aggregateId: string, operationType: string, payload: Record<string, unknown>) => {
      const item: OutboxItem = {
        id: `out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        aggregateType,
        aggregateId,
        operationType,
        payload,
        baseVersion: 1,
        idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
        status: isOnline ? 'applied' : 'pending',
      };
      setOutbox((prev) => [item, ...prev]);
    },
    [isOnline]
  );

  // Switch active patient
  const handleSelectPatient = (patientId: string) => {
    setActivePatientId(patientId);
    const pat = patients.find((p) => p.id === patientId);
    logAudit('PATIENT_RECORD_VIEW', 'patient', {
      resourceId: patientId,
      patientId,
      patientName: pat ? `${pat.familyName} ${pat.givenName}` : undefined,
      reasonText: 'Consultation du dossier patient par le professionnel',
    });
  };

  // Switch role / user
  const handleSwitchUser = (user: AppUser) => {
    setCurrentUser(user);
    logAudit('USER_LOGIN', 'session', {
      reasonText: `Connexion active du profil ${user.displayName} (${user.role})`,
    });
  };

  // Update patient referent doctor
  const handleUpdatePatientDoctor = (patientId: string, doctorId: string, doctorName: string) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? { ...p, primaryDoctorId: doctorId, primaryDoctorName: doctorName }
          : p
      )
    );
    logAudit('PATIENT_ASSIGN_DOCTOR', 'patient', {
      resourceId: patientId,
      patientId,
      reasonText: `Attribution du médecin traitant référent à : ${doctorName}`,
    });
  };

  // Save clinical note draft
  const handleSaveNoteDraft = (note: ClinicalNote) => {
    setClinicalNotes((prev) => ({ ...prev, [note.patientId]: note }));
    queueOutbox('clinical_note', note.id, 'CLINICAL_NOTE_DRAFT', note as any);
    logAudit('CLINICAL_NOTE_DRAFT_SAVE', 'clinical_note', {
      resourceId: note.id,
      patientId: note.patientId,
      patientName: `${activePatient.familyName} ${activePatient.givenName}`,
      reasonText: 'Enregistrement du brouillon de consultation SOAP',
    });
  };

  // Sign clinical note (immutable)
  const handleSignNote = (note: ClinicalNote) => {
    const signedNote: ClinicalNote = {
      ...note,
      status: 'signed',
      signedAt: new Date().toISOString(),
      signedBy: currentUser.id,
    };
    setClinicalNotes((prev) => ({ ...prev, [note.patientId]: signedNote }));
    queueOutbox('clinical_note', signedNote.id, 'CLINICAL_NOTE_SIGN', signedNote as any);
    logAudit('CLINICAL_NOTE_SIGN', 'clinical_note', {
      resourceId: signedNote.id,
      patientId: signedNote.patientId,
      patientName: `${activePatient.familyName} ${activePatient.givenName}`,
      reasonText: 'Signature électronique immuable de la consultation SOAP',
    });
  };

  // Add clinical addendum
  const handleAddAddendum = (addendumData: Omit<ClinicalAddendum, 'id' | 'authoredAt'>) => {
    const newAddendum: ClinicalAddendum = {
      ...addendumData,
      id: `add_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      authoredAt: new Date().toISOString(),
    };
    setAddenda((prev) => [...prev, newAddendum]);
    queueOutbox('clinical_addendum', newAddendum.id, 'CLINICAL_ADDENDUM_CREATE', newAddendum as any);
    logAudit('CLINICAL_ADDENDUM_CREATE', 'clinical_addendum', {
      resourceId: newAddendum.id,
      patientId: activePatient.id,
      patientName: `${activePatient.familyName} ${activePatient.givenName}`,
      reasonText: `Addendum rédigé : ${newAddendum.reason}`,
    });
  };

  // Save e-prescription order
  const handleSavePrescription = (order: MedicationOrder) => {
    setActiveOrders((prev) => [order, ...prev]);
    queueOutbox('medication_order', order.id, 'MEDICATION_PRESCRIBE', order as any);
    logAudit('MEDICATION_PRESCRIBE', 'medication_order', {
      resourceId: order.id,
      patientId: order.patientId,
      patientName: `${activePatient.familyName} ${activePatient.givenName}`,
      reasonText: order.overrideReason
        ? `Prescription avec dérogation médicale : ${order.overrideReason}`
        : `Prescription signée : ${order.medicationDisplay}`,
    });
  };

  // Add appointment
  const handleAddAppointment = (appt: Appointment) => {
    setAppointments((prev) => [...prev, appt]);
    queueOutbox('appointment', appt.id, 'APPOINTMENT_CREATE', appt as any);
    logAudit('APPOINTMENT_CREATE', 'appointment', {
      resourceId: appt.id,
      patientId: appt.patientId,
      patientName: appt.patientName,
      reasonText: `Planification de consultation : ${appt.reason} (${appt.roomCode})`,
    });
  };

  // Update appointment status
  const handleUpdateAppointmentStatus = (
    appointmentId: string,
    status: Appointment['status']
  ) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status } : a))
    );
    logAudit('APPOINTMENT_STATUS_UPDATE', 'appointment', {
      resourceId: appointmentId,
      reasonText: `Statut de consultation passé à : ${status}`,
    });
  };

  // Call queue ticket in waiting room
  const handleCallQueueTicket = (ticketId: string) => {
    setQueueTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, status: 'called', calledAt: new Date().toISOString() }
          : t
      )
    );
    const tkt = queueTickets.find((t) => t.id === ticketId);
    if (tkt) {
      logAudit('QUEUE_TICKET_CALL', 'queue_ticket', {
        resourceId: ticketId,
        patientId: tkt.patientId,
        patientName: tkt.patientName,
        reasonText: `Appel patient en salle d'attente vers ${tkt.roomCode}`,
      });
    }
  };

  // Add new patient admission
  const handleAddPatient = (newPat: Patient) => {
    setPatients((prev) => [newPat, ...prev]);
    setActivePatientId(newPat.id);
    queueOutbox('patient', newPat.id, 'PATIENT_CREATE', newPat as any);
    logAudit('PATIENT_CREATE', 'patient', {
      resourceId: newPat.id,
      patientId: newPat.id,
      patientName: `${newPat.familyName} ${newPat.givenName}`,
      reasonText: `Création du dossier patient maître (IPP : ${newPat.medicalRecordNumber})`,
    });
  };

  // Send message in secure chat
  const handleSendMessage = (conversationId: string, text: string) => {
    const isDoctor = currentUser.role === 'doctor';
    const newMsg: SecureMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      conversationId,
      senderType: isDoctor ? 'doctor' : 'patient',
      senderName: currentUser.displayName,
      body: text,
      sentAt: new Date().toISOString(),
      status: isOnline ? 'delivered' : 'queued',
      idempotencyKey: `idemp_msg_${Date.now()}`,
    };

    setMessages((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMsg],
    }));

    if (!isOnline) {
      queueOutbox('secure_message', newMsg.id, 'MESSAGE_SEND', newMsg as any);
    }

    logAudit('SECURE_MESSAGE_SEND', 'secure_message', {
      resourceId: newMsg.id,
      reasonText: 'Envoi d\'un message sécurisé dans le fil patient',
    });
  };

  // Convert chat message to follow-up task
  const handleConvertToFollowUp = (
    patientId: string,
    patientName: string,
    text: string
  ) => {
    const newTask: FollowUpTask = {
      id: `flw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      patientId,
      patientName,
      assignedToId: currentUser.id,
      assignedToName: currentUser.displayName,
      taskType: 'consultation_check',
      title: 'Action issue de message patient',
      objective: text,
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'important',
      status: 'pending',
    };
    setFollowUps((prev) => [newTask, ...prev]);
    setActiveTab('followups');
    logAudit('FOLLOW_UP_CREATE_FROM_MSG', 'follow_up_task', {
      resourceId: newTask.id,
      patientId,
      patientName,
      reasonText: 'Conversion d\'une demande par message sécurisé en tâche de suivi',
    });
  };

  // Add follow-up task
  const handleAddFollowUpTask = (task: FollowUpTask) => {
    setFollowUps((prev) => [task, ...prev]);
    queueOutbox('follow_up_task', task.id, 'FOLLOW_UP_CREATE', task as any);
    logAudit('FOLLOW_UP_CREATE', 'follow_up_task', {
      resourceId: task.id,
      patientId: task.patientId,
      patientName: task.patientName,
      reasonText: `Programmation d'un suivi : ${task.title}`,
    });
  };

  // Update follow-up task status
  const handleUpdateFollowUpStatus = (
    taskId: string,
    status: FollowUpTask['status']
  ) => {
    setFollowUps((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
    logAudit('FOLLOW_UP_STATUS_UPDATE', 'follow_up_task', {
      resourceId: taskId,
      reasonText: `Statut de suivi passé à : ${status}`,
    });
  };

  // Confirm Break-Glass
  const handleConfirmBreakGlass = (
    patientId: string,
    reason: string,
    durationMinutes: number
  ) => {
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    const pat = patients.find((p) => p.id === patientId);

    const event: BreakGlassEvent = {
      id: `bg_${Date.now()}`,
      requestedAt: new Date().toISOString(),
      actorUserId: currentUser.id,
      actorName: currentUser.displayName,
      patientId,
      patientName: pat ? `${pat.familyName} ${pat.givenName}` : 'Patient',
      reason,
      expiresAt,
      active: true,
    };

    setActiveBreakGlass(event);
    setActivePatientId(patientId);
    setActiveTab('workspace');

    logAudit('BREAK_GLASS_ACCESS', 'patient', {
      resourceId: patientId,
      patientId,
      patientName: event.patientName,
      outcome: 'allowed',
      reasonText: `BRIS DE GLACE EXCEPTIONNEL DECLENCHE : ${reason}`,
    });
  };

  // Manual Trigger Sync
  const handleTriggerSync = () => {
    setOutbox((prev) => prev.map((item) => ({ ...item, status: 'applied' })));
    setLastSyncTime(new Date().toISOString());
    logAudit('OFFLINE_SYNC_COMPLETE', 'sync_session', {
      reasonText: `Synchronisation idempotente réussie de ${outbox.length} opération(s)`,
    });
  };

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K -> Search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      {/* Universal Top Bar Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        allUsers={allUsers}
        onSwitchUser={handleSwitchUser}
        isOnline={isOnline}
        onToggleOnline={() => setIsOnline((prev) => !prev)}
        outboxCount={outbox.filter((o) => o.status === 'pending').length}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onOpenSearchModal={() => setIsSearchModalOpen(true)}
        onOpenBreakGlassModal={() => setIsBreakGlassModalOpen(true)}
        activeBreakGlass={activeBreakGlass}
      />

      {/* Main Clinical Viewport */}
      <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
        {activeTab === 'portal' && (
          <DoctorPortalView
            currentUser={currentUser}
            allUsers={allUsers}
            onSwitchUser={handleSwitchUser}
            patients={patients}
            appointments={appointments}
            queueTickets={queueTickets}
            followUps={followUps}
            conversations={conversations}
            onOpenConsultation={(patId) => {
              handleSelectPatient(patId);
              setActiveTab('workspace');
            }}
            onNavigateToSchedule={() => setActiveTab('schedule')}
            onNavigateToPatients={() => setActiveTab('patients')}
            onNavigateToFollowUps={() => setActiveTab('followups')}
            onNavigateToMessaging={() => setActiveTab('messaging')}
            onOpenCreateAppointment={() => setActiveTab('schedule')}
            onOpenCreatePatient={() => setActiveTab('patients')}
          />
        )}

        {activeTab === 'workspace' && (
          <DoctorWorkspace
            patient={activePatient}
            patientsList={patients}
            onSelectPatient={handleSelectPatient}
            currentUser={currentUser}
            clinicalNote={activeNote}
            addenda={addenda.filter((a) => a.encounterId === activeNote.encounterId)}
            activeMedications={patientActiveMedications}
            followUps={followUps}
            onSaveNoteDraft={handleSaveNoteDraft}
            onSignNote={handleSignNote}
            onAddAddendum={handleAddAddendum}
            onOpenPrescriptionModal={() => setIsPrescriptionModalOpen(true)}
            onOpenSchedule={() => setActiveTab('schedule')}
            onOpenFollowUpModal={() => setActiveTab('followups')}
            canEditClinical={permissions.canEditClinical}
            canPrescribe={permissions.canPrescribe}
          />
        )}

        {activeTab === 'schedule' && (
          <DoctorSchedule
            appointments={appointments}
            queueTickets={queueTickets}
            patients={patients}
            practitioners={allUsers.filter((u) => u.role === 'doctor')}
            currentPractitionerId={currentUser.id}
            onOpenConsultationForPatient={(patId) => {
              handleSelectPatient(patId);
              setActiveTab('workspace');
            }}
            onAddAppointment={handleAddAppointment}
            onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
            onCallQueueTicket={handleCallQueueTicket}
            canManageSchedule={permissions.canManageSchedule}
          />
        )}

        {activeTab === 'patients' && (
          <PatientListAndDetail
            patients={patients}
            onSelectPatient={handleSelectPatient}
            onOpenConsultation={(patId) => {
              handleSelectPatient(patId);
              setActiveTab('workspace');
            }}
            onAddPatient={handleAddPatient}
            canViewClinical={permissions.canViewClinical}
            currentUser={currentUser}
            allDoctors={allUsers.filter((u) => u.role === 'doctor')}
            onUpdatePatientDoctor={handleUpdatePatientDoctor}
            onOpenScheduleForPatient={(patId) => {
              handleSelectPatient(patId);
              setActiveTab('schedule');
            }}
          />
        )}

        {activeTab === 'followups' && (
          <FollowUpManager
            tasks={followUps}
            patients={patients}
            currentUser={currentUser}
            onAddTask={handleAddFollowUpTask}
            onUpdateTaskStatus={handleUpdateFollowUpStatus}
          />
        )}

        {activeTab === 'messaging' && (
          <SecureMessagingView
            conversations={conversations}
            messages={messages}
            currentUser={currentUser}
            patients={patients}
            onSendMessage={handleSendMessage}
            onConvertToFollowUp={handleConvertToFollowUp}
            isOnline={isOnline}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTrailView auditEvents={auditEvents} />
        )}
      </main>

      {/* Prescription Safety Modal */}
      {isPrescriptionModalOpen && (
        <PrescriptionSafetyModal
          isOpen={isPrescriptionModalOpen}
          onClose={() => setIsPrescriptionModalOpen(false)}
          patient={activePatient}
          catalog={INITIAL_MEDICATIONS}
          activeMedications={patientActiveMedications}
          currentUser={currentUser}
          onSavePrescription={handleSavePrescription}
          isOnline={isOnline}
        />
      )}

      {/* Patient Ctrl+K Search Modal */}
      {isSearchModalOpen && (
        <PatientSearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          patients={patients}
          appointments={appointments}
          onSelectPatient={(patId) => {
            handleSelectPatient(patId);
            setActiveTab('workspace');
          }}
        />
      )}

      {/* Break-Glass Emergency Modal */}
      {isBreakGlassModalOpen && (
        <BreakGlassModal
          isOpen={isBreakGlassModalOpen}
          onClose={() => setIsBreakGlassModalOpen(false)}
          currentUser={currentUser}
          patients={patients}
          onConfirmBreakGlass={handleConfirmBreakGlass}
        />
      )}

      {/* Offline Sync Outbox Modal */}
      {isSyncModalOpen && (
        <OfflineSyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          outbox={outbox}
          isOnline={isOnline}
          onTriggerSync={handleTriggerSync}
          lastSyncTime={lastSyncTime}
        />
      )}
    </div>
  );
}

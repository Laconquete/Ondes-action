import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  INITIAL_USERS,
  INITIAL_MEDICATIONS,
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
  DoctorNotification,
} from './types/clinical';
import { evaluateUserPermissions } from './services/clinicalEngine';
import { Header } from './components/Header';
import { DoctorPortalView } from './components/DoctorPortalView';
import { DoctorWorkspace } from './components/DoctorWorkspace';
import { DoctorSchedule } from './components/DoctorSchedule';
import { PatientListAndDetail } from './components/PatientListAndDetail';
import { SecureMessagingView } from './components/SecureMessagingView';
import { FollowUpManager } from './components/FollowUpManager';
import { AuditTrailView } from './components/AuditTrailView';
// Modales lazy-loadées — réduisent le bundle initial de ~80 kB (PrescriptionSafety 804 lignes + pdfExportService)
const PrescriptionSafetyModal = lazy(() =>
  import('./components/PrescriptionSafetyModal').then((m) => ({ default: m.PrescriptionSafetyModal }))
);
const BreakGlassModal = lazy(() =>
  import('./components/BreakGlassModal').then((m) => ({ default: m.BreakGlassModal }))
);
const PatientSearchModal = lazy(() =>
  import('./components/PatientSearchModal').then((m) => ({ default: m.PatientSearchModal }))
);
const OfflineSyncModal = lazy(() =>
  import('./components/OfflineSyncModal').then((m) => ({ default: m.OfflineSyncModal }))
);
const ReceptionCheckInModal = lazy(() =>
  import('./components/ReceptionCheckInModal').then((m) => ({ default: m.ReceptionCheckInModal }))
);
const AppointmentConflictDialog = lazy(() =>
  import('./components/AppointmentConflictDialog').then((m) => ({ default: m.AppointmentConflictDialog }))
);
// Nouveaux imports : authentification réelle + audit cryptographique
import { useAuthStore } from './stores/authStore';
// Hooks extraits (refactor god-component)
import { useModals } from './hooks/useModals';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { usePatientData } from './hooks/usePatientData';
import { useAuditLog } from './hooks/useAuditLog';
import { useOutbox } from './hooks/useOutbox';
import { useBreakGlass } from './hooks/useBreakGlass';

// Loader pour les modales lazy-loadées (affiché pendant le chargement du chunk)
const ModalLoader: React.FC = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-3 bg-white dark:bg-slate-900 p-6 shadow-2xl">
      <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent animate-spin" />
      <p className="text-xs text-slate-600 dark:text-slate-400">Chargement…</p>
    </div>
  </div>
);

export default function App() {
  // ============= AUTHENTIFICATION RÉELLE =============
  const authStoreUser = useAuthStore((s) => s.currentUser);
  const authStoreLogout = useAuthStore((s) => s.logout);
  const [legacyUserOverride, setLegacyUserOverride] = useState<AppUser | null>(null);
  const currentUser: AppUser = legacyUserOverride ?? authStoreUser ?? INITIAL_USERS[0];
  const [allUsers] = useState<AppUser[]>(INITIAL_USERS);

  useEffect(() => {
    if (!authStoreUser) setLegacyUserOverride(null);
  }, [authStoreUser]);

  // ============= HOOKS EXTRAITS =============
  // Réseau + outbox (offline-first)
  const { isOnline, outbox, lastSyncTime, setOutbox, setLastSyncTime } = useNetworkStatus();

  // Modales (6 états open/close centralisés)
  const modals = useModals();

  // Audit events (legacy UI state — le nouveau système crypto est dans auditStore)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(INITIAL_AUDIT_TRAIL);

  // Audit log (double journalisation : legacy + crypto SHA-256)
  const logAudit = useAuditLog({ currentUser, setAuditEvents });

  // Outbox queue
  const queueOutbox = useOutbox({ isOnline, setOutbox });

  // Break-glass (accès d'urgence)
  const { activeBreakGlass, isBreakGlassActive, confirmBreakGlass, endBreakGlass } = useBreakGlass({
    currentUser,
    onAudit: logAudit,
  });

  // Données cliniques (patients, notes, ordonnances, RDV, suivis, messagerie, notifications)
  const patientData = usePatientData({ onAudit: logAudit, onQueueOutbox: queueOutbox });
  const {
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
    setNotifications,
    addPatient,
    updatePatientDoctor,
    saveNoteDraft: handleSaveNoteDraft,
    signNote: handleSignNote,
    addAddendum: handleAddAddendum,
    addMedicationOrder: handleSavePrescription,
    addAppointment: handleAddAppointment,
    updateAppointmentStatus: handleUpdateAppointmentStatus,
    callQueueTicket: handleCallQueueTicket,
    sendMessage: handleSendMessage,
    addFollowUpTask: handleAddFollowUpTask,
    updateFollowUpStatus: handleUpdateFollowUpStatus,
    convertToFollowUp: handleConvertToFollowUp,
  } = patientData;

  // Notifications initiales (démo)
  useEffect(() => {
    if (notifications.length === 0) {
      setNotifications([
        {
          id: 'notif_init_01',
          timestamp: '10:28',
          doctorId: 'usr_nadia_martin',
          patientId: 'pat_jc_bernard',
          patientName: 'JEAN-CLAUDE BERNARD',
          patientMrn: 'MRN-2026-0422',
          ticketNumber: 'T-101',
          roomCode: 'Box 1',
          type: 'patient_arrival',
          title: 'Patient arrivé en salle d\'attente',
          message: 'Patient arrivé à l\'accueil pour son RDV de 10:30 (Contrôle INR & Douleurs genou)',
          read: false,
        },
      ]);
    }
  }, [notifications.length, setNotifications]);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    'portal' | 'workspace' | 'schedule' | 'patients' | 'followups' | 'messaging' | 'audit'
  >('portal');

  // Active patient (derived)
  const activePatient = useMemo(() => {
    return patients.find((p) => p.id === activePatientId) || patients[0];
  }, [patients, activePatientId]);

  // Active clinical note (derived — creates blank draft if not existing)
  const activeNote = useMemo(() => {
    if (clinicalNotes[activePatient.id]) {
      return clinicalNotes[activePatient.id];
    }
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

  // Active patient's medications (derived)
  const patientActiveMedications = useMemo(() => {
    return activeOrders.filter(
      (o) => o.patientId === activePatient.id && o.status === 'active'
    );
  }, [activeOrders, activePatient.id]);

  // Permissions (RBAC + break-glass)
  const permissions = useMemo(() => {
    return evaluateUserPermissions(currentUser.role, isBreakGlassActive);
  }, [currentUser.role, isBreakGlassActive]);

  // ============= HANDLERS (utilisent les hooks) =============
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

  const handleSwitchUser = (user: AppUser) => {
    setLegacyUserOverride(user);
    logAudit('USER_LOGIN', 'session', {
      reasonText: `Connexion active du profil ${user.displayName} (${user.role})`,
    });
  };

  // Déconnexion : appelle authStore.logout (détruit session locale + Supabase Auth)
  const handleLogout = async () => {
    logAudit('USER_LOGOUT', 'session', {
      reasonText: `Déconnexion de ${currentUser.displayName}`,
    });
    await authStoreLogout();
  };

  // Alias pour compatibilité JSX
  const handleAddPatient = addPatient;
  const handleUpdatePatientDoctor = updatePatientDoctor;

  // Wrapper pour SecureMessagingView (2 args au lieu de 4)
  const handleSendMessageWrapper = (conversationId: string, text: string) => {
    handleSendMessage(conversationId, text, currentUser.id, currentUser.displayName);
  };

  // Reception check-in (signature matchée avec ReceptionCheckInModal)
  const handleReceptionCheckIn = (params: {
    patient: Patient;
    appointmentId?: string;
    targetDoctorId: string;
    targetDoctorName: string;
    roomCode: string;
    reason: string;
    isWalkIn: boolean;
    priority: number;
  }) => {
    const patientName = `${params.patient.familyName} ${params.patient.givenName}`;
    const ticketNumber = `T-${Math.floor(Math.random() * 900) + 100}`;
    const newTicket: QueueTicket = {
      id: `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      appointmentId: params.appointmentId || `walkin_${Date.now()}`,
      patientId: params.patient.id,
      patientName,
      arrivedAt: new Date().toISOString(),
      roomCode: params.roomCode,
      priority: params.priority,
      status: 'waiting' as const,
    };
    setQueueTickets((prev) => [...prev, newTicket]);
    if (params.appointmentId) {
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === params.appointmentId ? { ...a, status: 'arrived' as const } : a
        )
      );
    }
    logAudit('PATIENT_CHECK_IN', 'queue_ticket', {
      resourceId: newTicket.id,
      patientId: params.patient.id,
      patientName,
      reasonText: `Arrivée patient ${patientName} (${params.patient.medicalRecordNumber}) — ticket ${ticketNumber}, salle ${params.roomCode}`,
    });
    queueOutbox('queue_ticket', newTicket.id, 'INSERT', newTicket as unknown as Record<string, unknown>);
    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        doctorId: params.targetDoctorId,
        patientId: params.patient.id,
        patientName: patientName.toUpperCase(),
        patientMrn: params.patient.medicalRecordNumber,
        ticketNumber,
        roomCode: params.roomCode,
        type: 'patient_arrival',
        title: 'Patient arrivé en salle d\'attente',
        message: `Patient arrivé à l'accueil — ticket ${ticketNumber}, salle ${params.roomCode}`,
        read: false,
      },
      ...prev,
    ]);
  };

  const handleAddNewPatientAndCheckIn = (
    newPatient: Patient,
    checkInParams: {
      targetDoctorId: string;
      targetDoctorName: string;
      roomCode: string;
      reason: string;
      priority: number;
    }
  ) => {
    addPatient(newPatient);
    const startsAt = new Date().toISOString();
    const newAppt: Appointment = {
      id: `appt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      patientId: newPatient.id,
      patientName: `${newPatient.familyName} ${newPatient.givenName}`,
      patientMrn: newPatient.medicalRecordNumber,
      practitionerId: checkInParams.targetDoctorId,
      practitionerName: checkInParams.targetDoctorName,
      serviceCode: 'CONSULT',
      appointmentType: 'consultation',
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + 30 * 60 * 1000).toISOString(),
      status: 'booked',
      reason: checkInParams.reason,
      roomCode: checkInParams.roomCode,
      priority: 0,
    };
    handleAddAppointment(newAppt);
  };

  const handleSelectNotification = (notif: DoctorNotification) => {
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
    if (notif.patientId) {
      handleSelectPatient(notif.patientId);
    }
  };

  // BreakGlassModal expects (patientId, reason, durationMinutes)
  const handleConfirmBreakGlassWrapper = (patientId: string, reason: string, _durationMinutes: number) => {
    const pat = patients.find((p) => p.id === patientId);
    const patientName = pat ? `${pat.familyName} ${pat.givenName}` : 'Patient';
    confirmBreakGlass(patientId, patientName, reason);
    modals.closeBreakGlass();
  };

  const handleTriggerSync = () => {
    setLastSyncTime(new Date().toISOString());
    logAudit('SYNC_MANUAL_TRIGGER', 'system', {
      reasonText: 'Synchronisation manuelle déclenchée par l\'utilisateur',
    });
  };

  const handleAddPatientWrapper = (newPat: Patient) => {
    addPatient(newPat);
  };

  // Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (modals.isSearchOpen) modals.closeSearch();
        else modals.openSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modals]);


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      {/* Universal Top Bar Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        allUsers={allUsers}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        isOnline={isOnline}
        onToggleOnline={() => { /* Toggle is now handled by useNetworkStatus (browser events) */ }}
        outboxCount={outbox.filter((o) => o.status === 'pending').length}
        onOpenSyncModal={() => modals.openSync()}
        onOpenSearchModal={() => modals.openSearch()}
        onOpenBreakGlassModal={() => modals.openBreakGlass()}
        activeBreakGlass={activeBreakGlass}
        notifications={currentUser.role === 'doctor' ? notifications.filter(n => n.doctorId === currentUser.id) : notifications}
        onSelectNotification={handleSelectNotification}
        onOpenReceptionCheckIn={() => modals.openReceptionCheckIn()}
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
            onOpenReceptionCheckIn={() => modals.openReceptionCheckIn()}
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
            onOpenPrescriptionModal={() => modals.openPrescription()}
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
            onOpenReceptionCheckIn={() => modals.openReceptionCheckIn()}
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
            onSendMessage={handleSendMessageWrapper}
            onConvertToFollowUp={handleConvertToFollowUp}
            isOnline={isOnline}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTrailView auditEvents={auditEvents} />
        )}
      </main>

      {/* Prescription Safety Modal (lazy) */}
      {modals.isPrescriptionOpen && (
        <Suspense fallback={<ModalLoader />}>
          <PrescriptionSafetyModal
            isOpen={modals.isPrescriptionOpen}
            onClose={() => modals.closePrescription()}
            patient={activePatient}
            catalog={INITIAL_MEDICATIONS}
            activeMedications={patientActiveMedications}
            currentUser={currentUser}
            onSavePrescription={handleSavePrescription}
            isOnline={isOnline}
          />
        </Suspense>
      )}

      {/* Patient Ctrl+K Search Modal (lazy) */}
      {modals.isSearchOpen && (
        <Suspense fallback={<ModalLoader />}>
          <PatientSearchModal
            isOpen={modals.isSearchOpen}
            onClose={() => modals.closeSearch()}
            patients={patients}
            appointments={appointments}
            onSelectPatient={(patId) => {
              handleSelectPatient(patId);
              setActiveTab('workspace');
            }}
          />
        </Suspense>
      )}

      {/* Break-Glass Emergency Modal (lazy) */}
      {modals.isBreakGlassOpen && (
        <Suspense fallback={<ModalLoader />}>
          <BreakGlassModal
            isOpen={modals.isBreakGlassOpen}
            onClose={() => modals.closeBreakGlass()}
            currentUser={currentUser}
            patients={patients}
            onConfirmBreakGlass={handleConfirmBreakGlassWrapper}
          />
        </Suspense>
      )}

      {/* Offline Sync Outbox Modal (lazy) */}
      {modals.isSyncOpen && (
        <Suspense fallback={<ModalLoader />}>
          <OfflineSyncModal
            isOpen={modals.isSyncOpen}
            onClose={() => modals.closeSync()}
            outbox={outbox}
            isOnline={isOnline}
            onTriggerSync={handleTriggerSync}
            lastSyncTime={lastSyncTime}
          />
        </Suspense>
      )}

      {/* Reception Check-In Desk Modal (lazy) */}
      {modals.isReceptionCheckInOpen && (
        <Suspense fallback={<ModalLoader />}>
          <ReceptionCheckInModal
            isOpen={modals.isReceptionCheckInOpen}
            onClose={() => modals.closeReceptionCheckIn()}
            patients={patients}
            appointments={appointments}
            doctors={allUsers.filter((u) => u.role === 'doctor')}
            onCheckInPatient={handleReceptionCheckIn}
            onAddNewPatientAndCheckIn={handleAddNewPatientAndCheckIn}
          />
        </Suspense>
      )}
    </div>
  );
}

import { useCallback } from 'react';
import { Patient, AppUser } from '../types/clinical';

/**
 * usePatientReservation — Gère la réservation, le transfert et la libération des patients.
 *
 * Règles métier (validées par l'utilisateur) :
 *
 * 1. RÉSERVER un patient :
 *    - Seul un médecin peut réserver un patient
 *    - Le patient devient "réservé" → seul le médecin titulaire peut consulter le détail
 *    - Les autres médecins voient un cadenas 🔒 avec le nom du titulaire au survol
 *    - Le médecin directeur (medical_director) peut déverrouiller (break-glass automatique)
 *
 * 2. TRANSFÉRER un patient :
 *    - Le médecin titulaire peut transférer le patient vers un autre médecin
 *    - Le transfert est "pending" jusqu'à acceptation du receveur
 *    - Le receveur reçoit une notification avec badge clignotant
 *    - Tant que le receveur n'a pas cliqué "Accepter", le transfert reste en attente
 *
 * 3. LIBÉRER un patient :
 *    - Le médecin titulaire peut "libérer" le patient → il redevient consultable par tous
 *    - Le patient revient en "Vue équipe" pour tous les médecins
 *
 * 4. DÉVERROUILLER (médecin directeur) :
 *    - Le médecin directeur peut accéder à un patient réservé
 *    - Action automatiquement loggée dans l'audit trail (break-glass)
 *    - Le médecin titulaire reçoit une notification "Accès dérogatoire"
 */

interface UsePatientReservationOptions {
  currentUser: AppUser;
  onUpdatePatient: (patientId: string, updates: Partial<Patient>) => void;
  onAudit?: (action: string, resourceType: string, details: {
    resourceId?: string;
    patientId?: string;
    patientName?: string;
    outcome?: 'allowed' | 'denied' | 'challenged';
    reasonText?: string;
  }) => void;
  onNotify?: (notification: {
    doctorId: string;
    patientId: string;
    patientName: string;
    type: 'transfer_request' | 'access_override' | 'transfer_accepted';
    title: string;
    message: string;
  }) => void;
}

interface PatientReservationState {
  // Réservation
  reservePatient: (patient: Patient, reason: string) => void;
  releasePatient: (patientId: string) => void;

  // Transfert
  transferPatient: (patient: Patient, toDoctor: AppUser) => void;
  acceptTransfer: (patient: Patient) => void;
  declineTransfer: (patient: Patient) => void;

  // Vérification d'accès
  canAccessPatient: (patient: Patient) => { allowed: boolean; reason?: string };
  isPatientReserved: (patient: Patient) => boolean;
  isReservedByMe: (patient: Patient, user: AppUser) => boolean;
}

export function usePatientReservation({
  currentUser,
  onUpdatePatient,
  onAudit,
  onNotify,
}: UsePatientReservationOptions): PatientReservationState {

  // === RÉSERVER un patient ===
  const reservePatient = useCallback((patient: Patient, reason: string) => {
    if (currentUser.role !== 'doctor' && currentUser.role !== 'medical_director') {
      onAudit?.('PATIENT_RESERVE_DENIED', 'patient', {
        resourceId: patient.id,
        patientId: patient.id,
        patientName: `${patient.familyName} ${patient.givenName}`,
        outcome: 'denied',
        reasonText: `Tentative de réservation par ${currentUser.role} (non autorisé)`,
      });
      return;
    }

    onUpdatePatient(patient.id, {
      isReserved: true,
      reservedById: currentUser.id,
      reservedByName: currentUser.displayName,
      reservedReason: reason,
      reservedAt: new Date().toISOString(),
      // Si le patient n'avait pas de médecin traitant, on l'assigne
      primaryDoctorId: patient.primaryDoctorId || currentUser.id,
      primaryDoctorName: patient.primaryDoctorName || currentUser.displayName,
    });

    onAudit?.('PATIENT_RESERVE', 'patient', {
      resourceId: patient.id,
      patientId: patient.id,
      patientName: `${patient.familyName} ${patient.givenName}`,
      reasonText: `Patient réservé par ${currentUser.displayName} : ${reason}`,
    });
  }, [currentUser, onUpdatePatient, onAudit]);

  // === LIBÉRER un patient ===
  const releasePatient = useCallback((patientId: string) => {
    onUpdatePatient(patientId, {
      isReserved: false,
      reservedById: undefined,
      reservedByName: undefined,
      reservedReason: undefined,
      reservedAt: undefined,
    });

    onAudit?.('PATIENT_RELEASE', 'patient', {
      resourceId: patientId,
      reasonText: `Patient libéré par ${currentUser.displayName} — redevient consultable par tous`,
    });
  }, [currentUser, onUpdatePatient, onAudit]);

  // === TRANSFÉRER un patient ===
  const transferPatient = useCallback((patient: Patient, toDoctor: AppUser) => {
    onUpdatePatient(patient.id, {
      pendingTransferToId: toDoctor.id,
      pendingTransferToName: toDoctor.displayName,
    });

    onAudit?.('PATIENT_TRANSFER_INITIATED', 'patient', {
      resourceId: patient.id,
      patientId: patient.id,
      patientName: `${patient.familyName} ${patient.givenName}`,
      reasonText: `Transfert initié par ${currentUser.displayName} vers ${toDoctor.displayName}`,
    });

    // Notifier le médecin receveur
    onNotify?.({
      doctorId: toDoctor.id,
      patientId: patient.id,
      patientName: `${patient.familyName} ${patient.givenName}`,
      type: 'transfer_request',
      title: 'Demande de transfert de patient',
      message: `${currentUser.displayName} vous transfère le patient ${patient.familyName} ${patient.givenName}. Cliquez pour accepter.`,
    });
  }, [currentUser, onUpdatePatient, onAudit, onNotify]);

  // === ACCEPTER un transfert ===
  const acceptTransfer = useCallback((patient: Patient) => {
    if (!patient.pendingTransferToId || patient.pendingTransferToId !== currentUser.id) {
      return; // Seul le médecin receveur peut accepter
    }

    onUpdatePatient(patient.id, {
      primaryDoctorId: currentUser.id,
      primaryDoctorName: currentUser.displayName,
      reservedById: currentUser.id,
      reservedByName: currentUser.displayName,
      isReserved: true, // Le patient reste réservé pour le nouveau titulaire
      reservedReason: `Transféré depuis ${patient.primaryDoctorName || 'autre médecin'}`,
      reservedAt: new Date().toISOString(),
      pendingTransferToId: undefined,
      pendingTransferToName: undefined,
    });

    onAudit?.('PATIENT_TRANSFER_ACCEPTED', 'patient', {
      resourceId: patient.id,
      patientId: patient.id,
      patientName: `${patient.familyName} ${patient.givenName}`,
      reasonText: `Transfert accepté par ${currentUser.displayName}`,
    });

    // Notifier l'ancien médecin titulaire
    if (patient.reservedById && patient.reservedById !== currentUser.id) {
      onNotify?.({
        doctorId: patient.reservedById,
        patientId: patient.id,
        patientName: `${patient.familyName} ${patient.givenName}`,
        type: 'transfer_accepted',
        title: 'Transfert accepté',
        message: `${currentUser.displayName} a accepté le transfert du patient ${patient.familyName} ${patient.givenName}.`,
      });
    }
  }, [currentUser, onUpdatePatient, onAudit, onNotify]);

  // === REFUSER un transfert ===
  const declineTransfer = useCallback((patient: Patient) => {
    if (!patient.pendingTransferToId || patient.pendingTransferToId !== currentUser.id) {
      return;
    }

    onUpdatePatient(patient.id, {
      pendingTransferToId: undefined,
      pendingTransferToName: undefined,
    });

    onAudit?.('PATIENT_TRANSFER_DECLINED', 'patient', {
      resourceId: patient.id,
      patientId: patient.id,
      patientName: `${patient.familyName} ${patient.givenName}`,
      reasonText: `Transfert refusé par ${currentUser.displayName}`,
    });
  }, [currentUser, onUpdatePatient, onAudit]);

  // === VÉRIFICATION D'ACCÈS ===
  const canAccessPatient = useCallback((patient: Patient): { allowed: boolean; reason?: string } => {
    // Le médecin directeur peut tout voir
    if (currentUser.role === 'medical_director') {
      return { allowed: true };
    }

    // Si le patient n'est pas réservé → tout le monde peut consulter
    if (!patient.isReserved) {
      return { allowed: true };
    }

    // Si le patient est réservé → seul le médecin titulaire peut consulter
    if (patient.reservedById === currentUser.id) {
      return { allowed: true };
    }

    // Autres médecins → accès refusé
    return {
      allowed: false,
      reason: `Patient réservé par ${patient.reservedByName}. Demandez un transfert ou contactez le médecin directeur.`,
    };
  }, [currentUser]);

  const isPatientReserved = useCallback((patient: Patient): boolean => {
    return patient.isReserved === true;
  }, []);

  const isReservedByMe = useCallback((patient: Patient, user: AppUser): boolean => {
    return patient.isReserved === true && patient.reservedById === user.id;
  }, []);

  return {
    reservePatient,
    releasePatient,
    transferPatient,
    acceptTransfer,
    declineTransfer,
    canAccessPatient,
    isPatientReserved,
    isReservedByMe,
  };
}

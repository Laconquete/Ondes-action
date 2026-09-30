/**
 * Clinique OneDesk — Modèles de données cliniques, RBAC & Synchronisation
 */

export type UserRole = 'doctor' | 'nurse' | 'receptionist' | 'auditor' | 'security_admin' | 'medical_director';

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  department: string;
  licenseNumber?: string;
  serviceCode: string;
}

export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'life_threatening' | 'critical';

export interface Allergy {
  id: string;
  substanceCode: string; // Code ATC du principe actif (ex: "N02AA01" pour codéine, "J01CA04" pour amoxicilline)
  substanceDisplay: string;
  // Code ATC de la classe allergénique (ex: "J01CA" pénicillines, "N02AA" opioïdes)
  // Permet un matching hiérarchique strict : pénicillamine (M01CB02) ≠ pénicilline (J01CA04)
  allergenClassCode?: string;
  reaction: string;
  severity: AllergySeverity;
  recordedAt: string;
  recordedBy: string;
  status: 'active' | 'inactive' | 'entered_in_error';
}

export interface VitalSignSet {
  id: string;
  measuredAt: string;
  measuredBy: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  systolic?: number;
  diastolic?: number;
  pulseBpm?: number;
  temperatureC?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
}

export interface Problem {
  id: string;
  codeSystem: string;
  code: string;
  display: string;
  onsetDate: string;
  clinicalStatus: 'active' | 'resolved';
}

export interface Patient {
  id: string;
  medicalRecordNumber: string; // IPP
  familyName: string;
  givenName: string;
  birthDate: string;
  gender: 'M' | 'F' | 'O';
  phone: string;
  email: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
  };
  bloodGroup: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  insurance: {
    provider: string;
    policyNumber: string;
  };
  allergies: Allergy[];
  problems: Problem[];
  vitalsHistory: VitalSignSet[];
  medicalHistory: string[];
  surgicalHistory?: string[];
  riskFactors: string[];
  status: 'active' | 'merged' | 'deceased';
  primaryDoctorId?: string;
  primaryDoctorName?: string;
  lastVisitDate?: string;
  tags?: string[];
  // === Réservation du patient ===
  // Si isReserved=true, seul le médecin "reservedById" peut consulter/modifier le dossier.
  // Les autres médecins voient un cadenas 🔒 dans la liste avec le nom du médecin titulaire.
  // Le médecin directeur (medical_director) peut déverrouiller temporairement (break-glass).
  isReserved?: boolean;
  reservedById?: string; // ID du médecin qui a réservé le patient
  reservedByName?: string;
  reservedReason?: string; // Motif de la réservation (ex: "Suivi cardiologique long terme")
  reservedAt?: string; // Date de la réservation
  // === Transfert de dossier ===
  // Quand un médecin transfère un patient, le transfert est en "pending" jusqu'à acceptation
  // du médecin receveur. Le médecin titulaire reçoit une notification avec badge clignotant.
  pendingTransferToId?: string;
  pendingTransferToName?: string;
}

// === Rôles utilisateurs ===
// "medical_director" = médecin directeur, peut déverrouiller un patient réservé (break-glass)
// Voir la définition de UserRole en haut du fichier.

export type AppointmentStatus =
  | 'booked'
  | 'confirmed'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  practitionerId: string;
  practitionerName: string;
  serviceCode: string;
  appointmentType: 'consultation' | 'suivi' | 'urgence' | 'teleconsultation';
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  status: AppointmentStatus;
  reason: string;
  roomCode: string;
  priority: 0 | 1 | 2; // 0=normal, 1=important, 2=urgent
  queueTicketId?: string;
  encounterId?: string;
}

export interface QueueTicket {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  arrivedAt: string;
  calledAt?: string;
  roomCode: string;
  status: 'waiting' | 'called' | 'in_room' | 'completed' | 'cancelled';
  priority: number;
}

export interface ClinicalNote {
  id: string;
  encounterId: string;
  patientId: string;
  subjective: {
    chiefComplaint: string;
    historyOfPresentIllness: string;
    symptoms: string[];
  };
  objective: {
    physicalExam: string;
    vitalsRecorded?: VitalSignSet;
  };
  assessment: {
    diagnoses: string[];
    clinicalEvaluation: string;
  };
  plan: {
    treatmentPlan: string;
    patientAdvice: string;
    dietaryRestrictions?: string;
  };
  followUp: {
    recommendedDate?: string;
    instructions?: string;
  };
  noteVersion: number;
  authoredBy: string;
  authoredByName: string;
  authoredAt: string;
  signedAt?: string;
  signedBy?: string;
  status: 'draft' | 'signed' | 'amended';
}

export interface ClinicalAddendum {
  id: string;
  encounterId: string;
  originalNoteId: string;
  text: string;
  reason: string;
  authoredBy: string;
  authoredByName: string;
  authoredAt: string;
}

export interface MedicationCatalogItem {
  id: string;
  code: string;
  // Code ATC complet du médicament (ex: "J01CA04" pour amoxicilline, "M01CB02" pour pénicillamine)
  // Référentiel WHO ATC : https://www.whocc.no/atc_ddd_index/
  atcCode: string;
  displayName: string;
  genericName: string;
  category: string;
  form: string;
  strength: string;
  standardDose: string;
  standardFrequency: string;
  standardDurationDays: number;
  routeOptions: string[];
  activeSubstances: string[]; // noms scientifiques (ex: ['amoxicilline', 'acide_clavulanique'])
  // Codes ATC des classes allergéniques (ex: ['J01CA', 'J01CR'])
  // Permet un matching strict par code, jamais par `.includes()` sur le display name
  allergenClassCodes: string[];
  // Maintenu pour rétro-compatibilité — déprécié, utiliser allergenClassCodes
  allergenClasses?: string[];
}

export interface MedicationOrder {
  id: string;
  patientId: string;
  encounterId?: string;
  medicationId: string;
  medicationDisplay: string;
  genericName: string;
  dosage: string;
  route: string;
  frequency: string;
  durationDays: number;
  quantity: string;
  refills: number;
  patientInstructions: string;
  clinicalIndication: string;
  prescriberId: string;
  prescriberName: string;
  authoredOn: string;
  status: 'draft' | 'active' | 'stopped' | 'cancelled';
  signedAt?: string;
  signedBy?: string;
  overrideReason?: string;
  ruleWarnings?: RuleFinding[];
}

export type RuleFindingSeverity = 'info' | 'minor' | 'moderate' | 'major' | 'critical';

export interface RuleFinding {
  ruleId: string;
  code: string;
  severity: RuleFindingSeverity;
  title: string;
  message: string;
  evidence: string[];
  missingData?: string[];
  action: 'inform' | 'review_required' | 'block_unless_overridden';
  requiresOverride: boolean;
}

export interface DecisionResult {
  decisionId: string;
  prescriptionId?: string;
  engineVersion: string;
  knowledgeVersion: string;
  evaluatedAt: string;
  findings: RuleFinding[];
  status: 'allowed' | 'warning' | 'blocked';
}

export interface FollowUpTask {
  id: string;
  patientId: string;
  patientName: string;
  assignedToName: string;
  assignedToId: string;
  taskType: 'call' | 'exam_control' | 'consultation_check' | 'prescription_renewal';
  title: string;
  objective: string;
  dueAt: string; // ISO
  priority: 'routine' | 'important' | 'urgent';
  status: 'pending' | 'in_progress' | 'done' | 'overdue';
  lastContactAt?: string;
  outcomeNotes?: string;
}

export interface SecureConversation {
  id: string;
  patientId: string;
  patientName: string;
  practitionerId: string;
  practitionerName: string;
  subject: string;
  status: 'open' | 'waiting_patient' | 'waiting_clinician' | 'closed';
  lastMessageAt: string;
  unreadByDoctor: boolean;
}

export interface SecureMessage {
  id: string;
  conversationId: string;
  senderType: 'doctor' | 'patient';
  senderName: string;
  body: string;
  sentAt: string;
  status: 'queued' | 'sent' | 'delivered' | 'read';
  idempotencyKey: string;
}

export interface AuditEvent {
  id: string;
  occurredAt: string;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId?: string;
  patientId?: string;
  patientName?: string;
  outcome: 'allowed' | 'denied' | 'challenged' | 'error';
  reasonText?: string;
  // Champs cryptographiques remplis par cryptoAuditService (chaînage SHA-256)
  eventHash?: string;
  previousHash?: string;
  tenantId?: string;
  integrityChainSeq?: number;
}

export interface OutboxItem {
  id: string;
  tenantId?: string; // Multi-tenant : rempli par clinicalStore lors de l'écriture locale
  aggregateType: string;
  aggregateId: string;
  operationType: string;
  payload: Record<string, unknown>;
  baseVersion: number;
  idempotencyKey: string;
  createdAt: string;
  status: 'pending' | 'applied' | 'failed' | 'conflict';
  appliedAt?: string; // Rempli quand l'item a été poussé avec succès vers Supabase
  errorMessage?: string; // Rempli en cas d'échec (pour debug et retry)
}

export interface BreakGlassEvent {
  id: string;
  requestedAt: string;
  actorUserId: string;
  actorName: string;
  patientId: string;
  patientName: string;
  reason: string;
  expiresAt: string;
  active: boolean;
}

export interface DoctorNotification {
  id: string;
  timestamp: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  ticketNumber: string;
  roomCode: string;
  appointmentTime?: string;
  type: 'patient_arrival' | 'urgent_walk_in' | 'queue_update';
  title: string;
  message: string;
  read: boolean;
}


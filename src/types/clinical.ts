/**
 * Clinique OneDesk — Modèles de données cliniques, RBAC & Synchronisation
 */

export type UserRole = 'doctor' | 'nurse' | 'receptionist' | 'auditor' | 'security_admin';

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
  substanceCode: string;
  substanceDisplay: string;
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
}

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
  displayName: string;
  genericName: string;
  category: string;
  form: string;
  strength: string;
  standardDose: string;
  standardFrequency: string;
  standardDurationDays: number;
  routeOptions: string[];
  activeSubstances: string[]; // e.g. ['amoxicilline', 'acide_clavulanique']
  allergenClasses: string[]; // e.g. ['penicillin', 'beta_lactam']
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
  outcome: 'allowed' | 'denied' | 'challenged';
  reasonText?: string;
  eventHash: string;
}

export interface OutboxItem {
  id: string;
  aggregateType: string;
  aggregateId: string;
  operationType: string;
  payload: Record<string, unknown>;
  baseVersion: number;
  idempotencyKey: string;
  createdAt: string;
  status: 'pending' | 'applied' | 'conflict';
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

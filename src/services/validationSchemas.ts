import { z } from 'zod';

/**
 * Schémas de validation Zod pour les données cliniques critiques.
 *
 * Objectif : empêcher toute donnée invalide de pénétrer la base locale ou Supabase.
 * S'utilise dans les formulaires (patient, prescription, vitals) et dans la couche API.
 */

// ============================================================
// 1. PATIENT
// ============================================================

const frenchPostalCodeRegex = /^\d{5}$/;
const frenchPhoneRegex = /^(?:\+33|0)[1-9](?:\d{8})$/;
const mrnRegex = /^MRN-\d{4}-\d{4,6}$/;

export const allergySchema = z.object({
  id: z.string().min(1),
  substanceCode: z.string().min(1, 'Code ATC requis'),
  substanceDisplay: z.string().min(1, 'Nom de substance requis'),
  allergenClassCode: z.string().optional(),
  reaction: z.string().max(500, 'Description trop longue').default(''),
  severity: z.enum(['mild', 'moderate', 'severe', 'life_threatening', 'critical']),
  recordedAt: z.string().min(1),
  recordedBy: z.string().min(1),
  status: z.enum(['active', 'inactive', 'entered_in_error']),
});

export const vitalSignSetSchema = z.object({
  id: z.string().min(1),
  measuredAt: z.string().min(1),
  measuredBy: z.string().min(1),
  heightCm: z.number().positive().min(30).max(250).optional(),
  weightKg: z.number().positive().min(1).max(400).optional(),
  bmi: z.number().positive().min(8).max(80).optional(),
  systolic: z.number().int().min(40).max(280).optional(),
  diastolic: z.number().int().min(20).max(180).optional(),
  pulseBpm: z.number().int().min(20).max(250).optional(),
  temperatureC: z.number().min(30).max(45).optional(),
  respiratoryRate: z.number().int().min(5).max(60).optional(),
  oxygenSaturation: z.number().int().min(50).max(100).optional(),
}).refine(
  (data) => {
    if (data.systolic != null && data.diastolic != null && data.systolic <= data.diastolic) {
      return false;
    }
    return true;
  },
  { message: 'La systolique doit être supérieure à la diastolique', path: ['systolic'] }
);

export const patientSchema = z.object({
  id: z.string().min(1),
  medicalRecordNumber: z.string().regex(mrnRegex, 'Format IPP attendu : MRN-AAAA-XXXXXX'),
  familyName: z.string().min(1, 'Nom requis').max(80),
  givenName: z.string().min(1, 'Prénom requis').max(80),
  birthDate: z.string().min(1, 'Date de naissance requise'),
  gender: z.enum(['M', 'F', 'O']),
  phone: z.string().regex(frenchPhoneRegex, 'Format téléphone français attendu').optional().or(z.literal('')),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  address: z.object({
    street: z.string().max(200).default(''),
    city: z.string().max(100).default(''),
    postalCode: z.string().regex(frenchPostalCodeRegex, 'Code postal à 5 chiffres').default(''),
  }),
  bloodGroup: z.string().max(10).default(''),
  emergencyContact: z.object({
    name: z.string().max(120).default(''),
    relationship: z.string().max(50).default(''),
    phone: z.string().regex(frenchPhoneRegex).optional().or(z.literal('')).default(''),
  }),
  insurance: z.object({
    provider: z.string().max(200).default(''),
    policyNumber: z.string().max(50).default(''),
  }),
  allergies: z.array(allergySchema).default([]),
  problems: z.array(z.object({
    id: z.string(),
    codeSystem: z.string(),
    code: z.string(),
    display: z.string(),
    onsetDate: z.string(),
    clinicalStatus: z.enum(['active', 'resolved']),
  })).default([]),
  vitalsHistory: z.array(vitalSignSetSchema).default([]),
  medicalHistory: z.array(z.string()).default([]),
  surgicalHistory: z.array(z.string()).optional().default([]),
  riskFactors: z.array(z.string()).default([]),
  status: z.enum(['active', 'merged', 'deceased']).default('active'),
  primaryDoctorId: z.string().optional(),
  primaryDoctorName: z.string().optional(),
  lastVisitDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type PatientInput = z.infer<typeof patientSchema>;

// ============================================================
// 2. PRESCRIPTION
// ============================================================

export const medicationOrderSchema = z.object({
  id: z.string().min(1),
  patientId: z.string().min(1),
  encounterId: z.string().optional(),
  medicationId: z.string().min(1),
  medicationDisplay: z.string().min(1),
  genericName: z.string().min(1),
  dosage: z.string().min(1, 'Posologie requise').max(200),
  route: z.string().min(1, 'Voie d administration requise'),
  frequency: z.string().min(1, 'Fréquence requise'),
  durationDays: z.number().int().min(1).max(365, 'Durée maximale 1 an'),
  quantity: z.string().min(1),
  status: z.enum(['active', 'completed', 'cancelled', 'suspended']).default('active'),
  prescribedBy: z.string().min(1),
  prescribedAt: z.string().min(1),
  // Pour la traçabilité des stupéfiants (ordre 0) :
  isNarcotic: z.boolean().default(false),
  prescriptionReason: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.isNarcotic && !data.prescriptionReason) return false;
    return true;
  },
  { message: 'Motif requis pour les stupéfiants (ordonnance sécurisée)', path: ['prescriptionReason'] }
);

export type MedicationOrderInput = z.infer<typeof medicationOrderSchema>;

// ============================================================
// 3. CLINICAL NOTE (SOAP)
// ============================================================

export const clinicalNoteSchema = z.object({
  id: z.string().min(1),
  encounterId: z.string().min(1),
  patientId: z.string().min(1),
  subjective: z.object({
    chiefComplaint: z.string().max(1000).default(''),
    historyOfPresentIllness: z.string().max(5000).default(''),
    symptoms: z.array(z.string()).default([]),
  }),
  objective: z.object({
    physicalExam: z.string().max(5000).default(''),
    vitalsRecorded: z.any().optional(),
  }),
  assessment: z.object({
    diagnoses: z.array(z.object({
      code: z.string(),
      display: z.string(),
      codeSystem: z.string().default('ICD-10'),
    })).default([]),
    clinicalEvaluation: z.string().max(5000).default(''),
  }),
  plan: z.object({
    treatmentPlan: z.string().max(5000).default(''),
    patientAdvice: z.string().max(2000).default(''),
  }),
  followUp: z.object({}).default({}),
  noteVersion: z.number().int().positive().default(1),
  authoredBy: z.string().min(1),
  authoredByName: z.string().min(1),
  authoredAt: z.string().min(1),
  signedAt: z.string().optional(),
  signedBy: z.string().optional(),
  status: z.enum(['draft', 'signed', 'amended']).default('draft'),
});

export type ClinicalNoteInput = z.infer<typeof clinicalNoteSchema>;

// ============================================================
// 4. AUDIT EVENT
// ============================================================

export const auditEventSchema = z.object({
  id: z.string().min(1),
  occurredAt: z.string().min(1),
  actorUserId: z.string().min(1),
  actorName: z.string().min(1),
  actorRole: z.string().min(1),
  action: z.string().min(1).max(100),
  resourceType: z.string().min(1).max(50),
  resourceId: z.string().optional(),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  outcome: z.enum(['allowed', 'denied', 'challenged', 'error']).default('allowed'),
  reasonText: z.string().max(1000).optional(),
  // Champs cryptographiques (remplis par cryptoAuditService)
  eventHash: z.string().optional(),
  previousHash: z.string().optional(),
  tenantId: z.string().optional(),
  integrityChainSeq: z.number().int().positive().optional(),
});

export type AuditEventInput = z.infer<typeof auditEventSchema>;

// ============================================================
// 5. APPOINTMENT
// ============================================================

export const appointmentSchema = z.object({
  id: z.string().min(1),
  patientId: z.string().min(1),
  practitionerId: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  reason: z.string().max(500).default(''),
  status: z.enum(['booked', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show']).default('booked'),
  encounterType: z.string().max(100).default('consultation'),
  tenantId: z.string().optional(),
}).refine(
  (data) => new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime(),
  { message: 'La date de fin doit être après la date de début', path: ['endsAt'] }
);

export type AppointmentInput = z.infer<typeof appointmentSchema>;

// ============================================================
// 6. UTILITAIRES
// ============================================================

/**
 * Valide une donnée et retourne un résultat structuré.
 * À utiliser dans les catch d'erreurs API ou de soumission de formulaire.
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Formate les erreurs Zod en un objet plat {field: message} pour l'UI.
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    if (!formatted[path]) {
      formatted[path] = issue.message;
    }
  }
  return formatted;
}

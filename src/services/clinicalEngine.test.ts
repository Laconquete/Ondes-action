import { describe, it, expect } from 'vitest';
import {
  evaluateMedicationSafety,
  checkAppointmentConflict,
  evaluateUserPermissions,
  ENGINE_VERSION,
  KNOWLEDGE_VERSION,
} from './clinicalEngine';
import {
  Patient,
  MedicationCatalogItem,
  MedicationOrder,
  Appointment,
  Allergy,
} from '../types/clinical';

const makePatient = (overrides: Partial<Patient> = {}): Patient => ({
  id: 'pat_test',
  medicalRecordNumber: 'MRN-2026-TEST',
  familyName: 'Test',
  givenName: 'Patient',
  birthDate: '1990-01-01',
  gender: 'M',
  phone: '',
  email: '',
  address: { street: '', city: '', postalCode: '' },
  bloodGroup: '',
  emergencyContact: { name: '', relationship: '', phone: '' },
  insurance: { provider: '', policyNumber: '' },
  allergies: [],
  problems: [],
  vitalsHistory: [],
  medicalHistory: [],
  riskFactors: [],
  status: 'active',
  ...overrides,
});

const makeMedication = (overrides: Partial<MedicationCatalogItem> = {}): MedicationCatalogItem => ({
  id: 'med_test',
  code: 'J01CA04',
  atcCode: 'J01CA04',
  displayName: 'Amoxicilline 1000 mg',
  genericName: 'amoxicilline',
  category: 'Antibactérien',
  form: 'Comprimé',
  strength: '1g',
  standardDose: '1 cp',
  standardFrequency: '2x/j',
  standardDurationDays: 6,
  routeOptions: ['Orale'],
  activeSubstances: ['amoxicilline'],
  allergenClassCodes: ['J01CA', 'J01C'],
  ...overrides,
});

const makeOrder = (overrides: Partial<MedicationOrder> = {}): MedicationOrder => ({
  id: 'ord_test',
  patientId: 'pat_test',
  medicationId: 'med_test',
  medicationDisplay: 'Warfarine 5 mg',
  genericName: 'warfarine',
  dosage: '5 mg',
  route: 'Orale',
  frequency: '1x/j',
  durationDays: 30,
  quantity: '30 cp',
  refills: 0,
  patientInstructions: '',
  clinicalIndication: '',
  prescriberId: 'usr_doc',
  prescriberName: 'Dr. Test',
  authoredOn: '2026-09-01T10:00:00Z',
  status: 'active',
  ...overrides,
});

const makeAllergy = (overrides: Partial<Allergy> = {}): Allergy => ({
  id: 'all_test',
  substanceCode: 'J01CA04',
  substanceDisplay: 'Pénicilline',
  reaction: 'Urticaire',
  severity: 'critical',
  recordedAt: '2021-01-01T00:00:00Z',
  recordedBy: 'Dr. Test',
  status: 'active',
  ...overrides,
});

describe('clinicalEngine — medication safety rules', () => {
  describe('evaluateMedicationSafety — Allergies', () => {
    it('blocks when patient has active allergy to the proposed medication class', () => {
      const patient = makePatient({
        allergies: [makeAllergy({ substanceDisplay: 'Pénicilline', substanceCode: 'penicillin' })],
      });
      const med = makeMedication({ allergenClasses: ['penicillin'] });
      const result = evaluateMedicationSafety(patient, med, []);
      expect(result.status).toBe('blocked');
      expect(result.findings.some((f) => f.code === 'ALLERGY_MATCH')).toBe(true);
    });

    it('allows when patient has no relevant allergies', () => {
      const patient = makePatient();
      const med = makeMedication({ genericName: 'paracétamol', allergenClasses: [] });
      const result = evaluateMedicationSafety(patient, med, []);
      expect(result.status).toBe('allowed');
    });

    it('ignores inactive allergies', () => {
      const patient = makePatient({
        allergies: [makeAllergy({ status: 'inactive' })],
      });
      const med = makeMedication({ allergenClasses: ['penicillin'] });
      const result = evaluateMedicationSafety(patient, med, []);
      expect(result.findings.some((f) => f.code === 'ALLERGY_MATCH')).toBe(false);
    });
  });

  describe('evaluateMedicationSafety — Drug-Drug Interactions (DDI)', () => {
    it('flags AINS + Anticoagulant interaction (bleeding risk)', () => {
      const patient = makePatient();
      const ibuprofene = makeMedication({
        genericName: 'ibuprofène',
        displayName: 'Ibuprofène 400 mg',
        allergenClasses: ['nsaid'],
      });
      const warfarine = makeOrder({ genericName: 'warfarine', medicationDisplay: 'Warfarine 5 mg' });
      const result = evaluateMedicationSafety(patient, ibuprofene, [warfarine]);
      expect(result.findings.some((f) => f.code === 'DDI_BLEEDING_RISK')).toBe(true);
      expect(result.status).toBe('warning');
    });

    it('flags Macrolide + Statine interaction (rhabdomyolysis risk)', () => {
      const patient = makePatient();
      const clarithromycine = makeMedication({
        genericName: 'clarithromycine',
        displayName: 'Clarithromycine 500 mg',
      });
      const atorvastatine = makeOrder({
        genericName: 'atorvastatine',
        medicationDisplay: 'Atorvastatine 40 mg',
      });
      const result = evaluateMedicationSafety(patient, clarithromycine, [atorvastatine]);
      expect(result.findings.some((f) => f.code === 'DDI_RHABDOMYOLYSIS')).toBe(true);
    });

    it('flags therapeutic duplication (same active substance)', () => {
      const patient = makePatient();
      const amox1 = makeMedication({ genericName: 'amoxicilline', activeSubstances: ['amoxicilline'] });
      const amox2 = makeOrder({
        genericName: 'amoxicilline',
        medicationDisplay: 'Amoxicilline 500 mg',
      });
      const result = evaluateMedicationSafety(patient, amox1, [amox2]);
      expect(result.findings.some((f) => f.code === 'THERAPEUTIC_DUPLICATION')).toBe(true);
    });
  });

  describe('evaluateMedicationSafety — Contraindications', () => {
    it('warns about NSAID for asthma patients (Widal syndrome)', () => {
      const patient = makePatient({
        problems: [
          {
            id: 'pr_asthma',
            codeSystem: 'CIM-10',
            code: 'J45.0',
            display: 'Asthme intermittent modéré',
            onsetDate: '2015-01-01',
            clinicalStatus: 'active',
          },
        ],
      });
      const ibuprofene = makeMedication({ genericName: 'ibuprofène' });
      const result = evaluateMedicationSafety(patient, ibuprofene, []);
      expect(result.findings.some((f) => f.code === 'CONTRAINDICATION_ASTHMA')).toBe(true);
    });
  });

  describe('evaluateMedicationSafety — Decision metadata', () => {
    it('includes engine and knowledge versions for traceability', () => {
      const result = evaluateMedicationSafety(makePatient(), makeMedication(), []);
      expect(result.engineVersion).toBe(ENGINE_VERSION);
      expect(result.knowledgeVersion).toBe(KNOWLEDGE_VERSION);
      expect(result.decisionId).toMatch(/^dec_\d+_/);
      expect(result.evaluatedAt).toBeDefined();
    });
  });
});

describe('clinicalEngine — appointment conflicts', () => {
  const baseAppt: Appointment = {
    id: 'appt_1',
    patientId: 'pat_1',
    patientName: 'Test Patient',
    patientMrn: 'MRN-2026-TEST',
    practitionerId: 'usr_doc',
    practitionerName: 'Dr. Test',
    serviceCode: 'URG',
    appointmentType: 'consultation',
    startsAt: '2026-09-30T10:00:00Z',
    endsAt: '2026-09-30T10:30:00Z',
    status: 'confirmed',
    reason: 'Consultation',
    roomCode: 'Box 1',
    priority: 0,
  };

  it('detects overlap with existing appointment', () => {
    const existingAppts = [baseAppt];
    const result = checkAppointmentConflict(
      'usr_doc',
      '2026-09-30T10:15:00Z',
      '2026-09-30T10:45:00Z',
      existingAppts
    );
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingAppointment?.id).toBe('appt_1');
    expect(result.suggestedSlots.length).toBeGreaterThan(0);
  });

  it('returns no conflict when no overlap', () => {
    const existingAppts = [baseAppt];
    const result = checkAppointmentConflict(
      'usr_doc',
      '2026-09-30T11:00:00Z',
      '2026-09-30T11:30:00Z',
      existingAppts
    );
    expect(result.hasConflict).toBe(false);
  });

  it('ignores cancelled appointments', () => {
    const cancelledAppt = { ...baseAppt, status: 'cancelled' as const };
    const result = checkAppointmentConflict(
      'usr_doc',
      '2026-09-30T10:00:00Z',
      '2026-09-30T10:30:00Z',
      [cancelledAppt]
    );
    expect(result.hasConflict).toBe(false);
  });

  it('ignores excluded appointment ID (for reschedule)', () => {
    const result = checkAppointmentConflict(
      'usr_doc',
      '2026-09-30T10:00:00Z',
      '2026-09-30T10:30:00Z',
      [baseAppt],
      'appt_1'
    );
    expect(result.hasConflict).toBe(false);
  });

  it('filters by practitioner (different doctors do not conflict)', () => {
    const result = checkAppointmentConflict(
      'usr_other',
      '2026-09-30T10:00:00Z',
      '2026-09-30T10:30:00Z',
      [baseAppt]
    );
    expect(result.hasConflict).toBe(false);
  });

  it('suggests alternative slots when conflict detected', () => {
    const result = checkAppointmentConflict(
      'usr_doc',
      '2026-09-30T10:15:00Z',
      '2026-09-30T10:45:00Z',
      [baseAppt]
    );
    expect(result.suggestedSlots.length).toBe(3);
    expect(result.suggestedSlots.every((s) => s.startsAt && s.endsAt && s.label)).toBe(true);
  });
});

describe('clinicalEngine — RBAC permissions', () => {
  it('grants full clinical access to doctors', () => {
    const perms = evaluateUserPermissions('doctor');
    expect(perms.canViewClinical).toBe(true);
    expect(perms.canEditClinical).toBe(true);
    expect(perms.canPrescribe).toBe(true);
    expect(perms.canManageSchedule).toBe(true);
  });

  it('restricts prescription to doctors only', () => {
    expect(evaluateUserPermissions('nurse').canPrescribe).toBe(false);
    expect(evaluateUserPermissions('receptionist').canPrescribe).toBe(false);
    expect(evaluateUserPermissions('auditor').canPrescribe).toBe(false);
  });

  it('blocks receptionist from clinical data (RGPD/CNIL compliance)', () => {
    const perms = evaluateUserPermissions('receptionist');
    expect(perms.canViewClinical).toBe(false);
    expect(perms.canEditClinical).toBe(false);
    expect(perms.canPrescribe).toBe(false);
  });

  it('grants audit access only to auditor and security_admin', () => {
    expect(evaluateUserPermissions('auditor').canViewAudit).toBe(true);
    expect(evaluateUserPermissions('security_admin').canViewAudit).toBe(true);
    expect(evaluateUserPermissions('doctor').canViewAudit).toBe(false);
    expect(evaluateUserPermissions('receptionist').canViewAudit).toBe(false);
  });

  it('allows break-glass to override clinical restrictions for doctors/nurses', () => {
    const perms = evaluateUserPermissions('receptionist', true);
    expect(perms.canViewClinical).toBe(true);
    expect(perms.canEditClinical).toBe(true);
  });

  it('does NOT grant prescription to non-doctors even with break-glass', () => {
    // Break-glass is for emergency viewing/editing, not prescribing
    expect(evaluateUserPermissions('nurse', true).canPrescribe).toBe(false);
  });

  it('restricts break-glass to doctors and nurses only', () => {
    expect(evaluateUserPermissions('doctor').canBreakGlass).toBe(true);
    expect(evaluateUserPermissions('nurse').canBreakGlass).toBe(true);
    expect(evaluateUserPermissions('receptionist').canBreakGlass).toBe(false);
    expect(evaluateUserPermissions('auditor').canBreakGlass).toBe(false);
  });
});

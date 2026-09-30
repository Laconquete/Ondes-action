import { describe, it, expect } from 'vitest';
import {
  normalizeAtcCode,
  getAtcLevel,
  sharePharmacologicalPrefix,
  isExactSubstanceMatch,
  evaluateAllergyRisk,
  isPrescriptionSafeRegardingAllergies,
} from './allergyMatchingService';
import { Allergy, MedicationCatalogItem, Patient } from '../types/clinical';

const makePatient = (allergies: Allergy[]): Patient => ({
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
  allergies,
  problems: [],
  vitalsHistory: [],
  medicalHistory: [],
  riskFactors: [],
  status: 'active',
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

const makeAllergy = (overrides: Partial<Allergy> = {}): Allergy => ({
  id: 'all_test',
  substanceCode: 'J01CA04',
  substanceDisplay: 'Amoxicilline',
  allergenClassCode: 'J01CA',
  reaction: 'Urticaire',
  severity: 'critical',
  recordedAt: '2021-01-01T00:00:00Z',
  recordedBy: 'Dr. Test',
  status: 'active',
  ...overrides,
});

describe('allergyMatchingService', () => {
  describe('normalizeAtcCode', () => {
    it('normalizes valid ATC codes', () => {
      expect(normalizeAtcCode('J01CA04')).toBe('J01CA04');
      expect(normalizeAtcCode('j01ca04')).toBe('J01CA04');
      expect(normalizeAtcCode('  J01CA04  ')).toBe('J01CA04');
    });

    it('returns false for invalid codes', () => {
      expect(normalizeAtcCode('invalid')).toBeNull();
      expect(normalizeAtcCode('12345')).toBeNull();
      expect(normalizeAtcCode('')).toBeNull();
      expect(normalizeAtcCode(null as unknown as string)).toBeNull();
      expect(normalizeAtcCode(undefined as unknown as string)).toBeNull();
    });

    it('accepts class-level codes (3+ chars)', () => {
      expect(normalizeAtcCode('J01')).toBe('J01');
      expect(normalizeAtcCode('J01C')).toBe('J01C');
      expect(normalizeAtcCode('J01CA')).toBe('J01CA');
    });
  });

  describe('getAtcLevel', () => {
    it('returns correct hierarchy level', () => {
      // Niveau 2 = thérapeutique (1 lettre + 2 chiffres)
      expect(getAtcLevel('J01')).toBe(2);
      // Niveau 3 = pharmacologique (+ 1 lettre)
      expect(getAtcLevel('J01C')).toBe(3);
      // Niveau 4 = sous-groupe (+ 1 lettre)
      expect(getAtcLevel('J01CA')).toBe(4);
      // Niveau 5 = substance (+ 2 chiffres)
      expect(getAtcLevel('J01CA04')).toBe(5);
    });
  });

  describe('sharePharmacologicalPrefix', () => {
    it('returns true for codes sharing the 4-char prefix (same pharmacological class)', () => {
      // Amoxicilline (J01CA04) and Ampicilline (J01CA01) share J01CA = pénicillines large spectre
      expect(sharePharmacologicalPrefix('J01CA04', 'J01CA01')).toBe(true);
    });

    it('returns false for codes in different pharmacological classes', () => {
      // Pénicilline (J01CA) vs Pénicillamine (M01CB) — the CRITICAL fix
      expect(sharePharmacologicalPrefix('J01CA04', 'M01CB02')).toBe(false);
    });

    it('returns false for invalid codes', () => {
      expect(sharePharmacologicalPrefix('invalid', 'J01CA04')).toBe(false);
      expect(sharePharmacologicalPrefix(null as unknown as string, 'J01CA04')).toBe(false);
    });

    it('returns false if either code is too short (< 4 chars)', () => {
      expect(sharePharmacologicalPrefix('J01', 'J01CA04')).toBe(false);
    });
  });

  describe('isExactSubstanceMatch', () => {
    it('returns true for identical substances', () => {
      expect(isExactSubstanceMatch('J01CA04', 'J01CA04')).toBe(true);
    });

    it('returns false for different substances in the same class', () => {
      expect(isExactSubstanceMatch('J01CA04', 'J01CA01')).toBe(false);
    });

    it('returns false for codes shorter than substance level', () => {
      expect(isExactSubstanceMatch('J01C', 'J01CA04')).toBe(false);
    });
  });

  describe('evaluateAllergyRisk — THE CRITICAL FIX', () => {
    it('CRITICAL: Pénicillamine (M01CB02) does NOT match Pénicilline allergy (J01CA04)', () => {
      // This was the bug we fixed: .includes('penicill') matched both, causing false positives
      const patient = makePatient([
        makeAllergy({
          substanceCode: 'J01CA04',
          substanceDisplay: 'Pénicilline',
          allergenClassCode: 'J01CA',
          severity: 'critical',
        }),
      ]);
      const penicillamine = makeMedication({
        atcCode: 'M01CB02',
        displayName: 'Pénicillamine 300 mg',
        genericName: 'pénicillamine',
        allergenClassCodes: ['M01CB'],
      });
      const results = evaluateAllergyRisk(patient, penicillamine);
      expect(results.some((r) => r.matched)).toBe(false);
    });

    it('detects exact substance match (same ATC code)', () => {
      const patient = makePatient([
        makeAllergy({ substanceCode: 'J01CA04', substanceDisplay: 'Amoxicilline' }),
      ]);
      const amoxicilline = makeMedication({ atcCode: 'J01CA04' });
      const results = evaluateAllergyRisk(patient, amoxicilline);
      expect(results.some((r) => r.matched && r.matchType === 'exact_substance')).toBe(true);
    });

    it('detects cross-reaction within the same pharmacological class', () => {
      const patient = makePatient([
        makeAllergy({
          substanceCode: 'J01CA01', // Ampicilline
          substanceDisplay: 'Ampicilline',
          allergenClassCode: 'J01CA',
        }),
      ]);
      const amoxicilline = makeMedication({ atcCode: 'J01CA04' });
      const results = evaluateAllergyRisk(patient, amoxicilline);
      expect(
        results.some(
          (r) => r.matched && r.matchType === 'same_pharmacological_class' && r.matchedAllergy?.severity === 'critical'
        )
      ).toBe(true);
    });

    it('returns no-match for a safe prescription', () => {
      const patient = makePatient([
        makeAllergy({ substanceCode: 'J01CA04', substanceDisplay: 'Pénicilline' }),
      ]);
      const paracetamol = makeMedication({
        atcCode: 'N02BE01',
        displayName: 'Paracétamol',
        genericName: 'paracétamol',
        allergenClassCodes: ['N02BE'],
      });
      const results = evaluateAllergyRisk(patient, paracetamol);
      expect(results.some((r) => r.matched)).toBe(false);
    });

    it('handles inactive allergies (does not match)', () => {
      const patient = makePatient([
        makeAllergy({
          substanceCode: 'J01CA04',
          status: 'inactive',
        }),
      ]);
      const amoxicilline = makeMedication({ atcCode: 'J01CA04' });
      const results = evaluateAllergyRisk(patient, amoxicilline);
      expect(results.some((r) => r.matched)).toBe(false);
    });

    it('handles legacy allergies without ATC code (does not crash, returns uncertainty note)', () => {
      const patient = makePatient([
        makeAllergy({
          substanceCode: 'penicillin', // legacy display-based code
          allergenClassCode: undefined,
        }),
      ]);
      const amoxicilline = makeMedication({ atcCode: 'J01CA04' });
      const results = evaluateAllergyRisk(patient, amoxicilline);
      // Should not crash, and should flag for manual verification
      expect(results.some((r) => r.matchedAllergy && r.safetyNote.includes('legacy'))).toBe(true);
    });
  });

  describe('isPrescriptionSafeRegardingAllergies', () => {
    it('blocks critical allergies (exact match)', () => {
      const patient = makePatient([
        makeAllergy({
          substanceCode: 'J01CA04',
          severity: 'critical',
        }),
      ]);
      const med = makeMedication({ atcCode: 'J01CA04' });
      const result = isPrescriptionSafeRegardingAllergies(patient, med);
      expect(result.safe).toBe(false);
      expect(result.blockingReason).toBeDefined();
    });

    it('allows when no allergy matches', () => {
      const patient = makePatient([
        makeAllergy({ substanceCode: 'J01CA04' }),
      ]);
      const med = makeMedication({ atcCode: 'N02BE01', allergenClassCodes: ['N02BE'] });
      const result = isPrescriptionSafeRegardingAllergies(patient, med);
      expect(result.safe).toBe(true);
      expect(result.blockingReason).toBeUndefined();
    });

    it('allows mild allergies (does not block, just informs)', () => {
      const patient = makePatient([
        makeAllergy({
          substanceCode: 'J01CA04',
          severity: 'mild',
        }),
      ]);
      const med = makeMedication({ atcCode: 'J01CA04' });
      const result = isPrescriptionSafeRegardingAllergies(patient, med);
      expect(result.safe).toBe(true);
    });
  });
});

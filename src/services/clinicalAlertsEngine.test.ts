import { describe, it, expect } from 'vitest';
import {
  analyzeVitalSet,
  getPatientAlertLevel,
  getCabinetVitalAlertsSummary,
  analyzePatientVitals,
} from './clinicalAlertsEngine';
import { Patient, VitalSignSet } from '../types/clinical';

const makeVitals = (overrides: Partial<VitalSignSet> = {}): VitalSignSet => ({
  id: 'vit_test',
  measuredAt: '2026-09-30T10:00:00Z',
  measuredBy: 'Dr. Test',
  ...overrides,
});

const makePatient = (vitalsHistory: VitalSignSet[]): Patient => ({
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
  vitalsHistory,
  medicalHistory: [],
  riskFactors: [],
  status: 'active',
});

describe('clinicalAlertsEngine — HAS / SFHTA thresholds', () => {
  describe('Blood pressure (Tension Artérielle)', () => {
    it('flags hypertensive crisis when systolic >= 180', () => {
      const alerts = analyzeVitalSet(makeVitals({ systolic: 185, diastolic: 110 }));
      expect(alerts.some((a) => a.severity === 'critical' && a.category === 'blood_pressure')).toBe(true);
    });

    it('flags hypertensive crisis when diastolic >= 120', () => {
      const alerts = analyzeVitalSet(makeVitals({ systolic: 160, diastolic: 125 }));
      expect(alerts.some((a) => a.severity === 'critical' && a.badgeLabel === 'Crise Hypertensive')).toBe(true);
    });

    it('flags HTA Stage 2 when systolic >= 140 (HAS threshold)', () => {
      const alerts = analyzeVitalSet(makeVitals({ systolic: 145, diastolic: 95 }));
      const htaAlert = alerts.find((a) => a.badgeLabel === 'HTA Stade 2');
      expect(htaAlert).toBeDefined();
      expect(htaAlert?.severity).toBe('warning');
    });

    it('flags high-normal BP when systolic >= 135', () => {
      const alerts = analyzeVitalSet(makeVitals({ systolic: 137, diastolic: 86 }));
      expect(alerts.some((a) => a.severity === 'info' && a.badgeLabel === 'TA Normale Haute')).toBe(true);
    });

    it('flags hypotension when systolic < 90', () => {
      const alerts = analyzeVitalSet(makeVitals({ systolic: 85, diastolic: 55 }));
      expect(alerts.some((a) => a.badgeLabel === 'Hypotension')).toBe(true);
    });

    it('does not flag normal BP', () => {
      const alerts = analyzeVitalSet(makeVitals({ systolic: 120, diastolic: 80 }));
      expect(alerts.some((a) => a.category === 'blood_pressure')).toBe(false);
    });
  });

  describe('Pulse (Heart Rate)', () => {
    it('flags severe tachycardia when pulse >= 120', () => {
      const alerts = analyzeVitalSet(makeVitals({ pulseBpm: 130 }));
      expect(alerts.some((a) => a.severity === 'critical' && a.badgeLabel === 'Tachycardie Sévère')).toBe(true);
    });

    it('flags tachycardia when pulse > 100', () => {
      const alerts = analyzeVitalSet(makeVitals({ pulseBpm: 105 }));
      expect(alerts.some((a) => a.badgeLabel === 'Tachycardie')).toBe(true);
    });

    it('flags severe bradycardia when pulse < 45', () => {
      const alerts = analyzeVitalSet(makeVitals({ pulseBpm: 42 }));
      expect(alerts.some((a) => a.severity === 'critical' && a.badgeLabel === 'Bradycardie Sévère')).toBe(true);
    });

    it('flags bradycardia when pulse < 50', () => {
      const alerts = analyzeVitalSet(makeVitals({ pulseBpm: 48 }));
      expect(alerts.some((a) => a.badgeLabel === 'Bradycardie')).toBe(true);
    });

    it('does not flag normal pulse', () => {
      const alerts = analyzeVitalSet(makeVitals({ pulseBpm: 72 }));
      expect(alerts.some((a) => a.category === 'pulse')).toBe(false);
    });
  });

  describe('Oxygen saturation (SpO2)', () => {
    it('flags critical hypoxia when SpO2 < 90', () => {
      const alerts = analyzeVitalSet(makeVitals({ oxygenSaturation: 88 }));
      expect(alerts.some((a) => a.severity === 'critical' && a.badgeLabel === 'Hypoxie Sévère')).toBe(true);
    });

    it('flags desaturation when SpO2 < 95', () => {
      const alerts = analyzeVitalSet(makeVitals({ oxygenSaturation: 93 }));
      expect(alerts.some((a) => a.badgeLabel === 'Désaturation')).toBe(true);
    });

    it('does not flag normal SpO2', () => {
      const alerts = analyzeVitalSet(makeVitals({ oxygenSaturation: 98 }));
      expect(alerts.some((a) => a.category === 'oxygen_saturation')).toBe(false);
    });
  });

  describe('Temperature', () => {
    it('flags critical hyperthermia when temp >= 39.5°C', () => {
      const alerts = analyzeVitalSet(makeVitals({ temperatureC: 40 }));
      expect(alerts.some((a) => a.severity === 'critical' && a.badgeLabel === 'Hyperthermie Majeure')).toBe(true);
    });

    it('flags acute fever when temp >= 38.3°C', () => {
      const alerts = analyzeVitalSet(makeVitals({ temperatureC: 38.8 }));
      expect(alerts.some((a) => a.badgeLabel === 'Fièvre Aiguë')).toBe(true);
    });

    it('flags hypothermia when temp < 35.5°C', () => {
      const alerts = analyzeVitalSet(makeVitals({ temperatureC: 35 }));
      expect(alerts.some((a) => a.badgeLabel === 'Hypothermie')).toBe(true);
    });
  });

  describe('BMI', () => {
    it('flags severe obesity when BMI >= 35', () => {
      const alerts = analyzeVitalSet(makeVitals({ bmi: 38 }));
      expect(alerts.some((a) => a.badgeLabel === 'Obésité Sévère')).toBe(true);
    });

    it('flags underweight when BMI < 18.5', () => {
      const alerts = analyzeVitalSet(makeVitals({ bmi: 17 }));
      expect(alerts.some((a) => a.badgeLabel === 'Dénutrition')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('handles empty vitals gracefully', () => {
      const alerts = analyzeVitalSet(makeVitals({}));
      expect(alerts).toEqual([]);
    });

    it('handles zero values without crashing', () => {
      const alerts = analyzeVitalSet(makeVitals({ systolic: 0, diastolic: 0, pulseBpm: 0 }));
      expect(alerts).toEqual([]);
    });
  });

  describe('getPatientAlertLevel', () => {
    it('returns critical when at least one critical alert exists', () => {
      const alerts = analyzeVitalSet(makeVitals({ systolic: 190, diastolic: 130 }));
      expect(getPatientAlertLevel(alerts)).toBe('critical');
    });

    it('returns warning when only warnings exist', () => {
      const alerts = analyzeVitalSet(makeVitals({ systolic: 145, diastolic: 95 }));
      expect(getPatientAlertLevel(alerts)).toBe('warning');
    });

    it('returns normal when no alerts', () => {
      expect(getPatientAlertLevel([])).toBe('normal');
    });
  });

  describe('analyzePatientVitals', () => {
    it('uses the most recent vital set', () => {
      const patient = makePatient([
        makeVitals({ id: 'old', measuredAt: '2026-09-01T10:00:00Z', systolic: 130, diastolic: 85 }),
        makeVitals({ id: 'recent', measuredAt: '2026-09-30T10:00:00Z', systolic: 160, diastolic: 100 }),
      ]);
      const alerts = analyzePatientVitals(patient);
      expect(alerts.some((a) => a.badgeLabel === 'HTA Stade 2')).toBe(true);
    });

    it('returns empty when no vitals', () => {
      const patient = makePatient([]);
      expect(analyzePatientVitals(patient)).toEqual([]);
    });
  });

  describe('getCabinetVitalAlertsSummary', () => {
    it('counts alerts across multiple patients', () => {
      const patients = [
        makePatient([makeVitals({ systolic: 145, diastolic: 95 })]),
        makePatient([makeVitals({ systolic: 185, diastolic: 125 })]),
        makePatient([makeVitals({ systolic: 120, diastolic: 80 })]),
      ];
      const summary = getCabinetVitalAlertsSummary(patients);
      expect(summary.patientsWithAlerts.length).toBe(2);
      expect(summary.criticalCount).toBeGreaterThanOrEqual(1);
      expect(summary.warningCount).toBeGreaterThanOrEqual(1);
    });
  });
});

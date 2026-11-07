import { describe, it, expect } from '@jest/globals';
import {
  createVisitSchema,
  updateVisitNotesSchema,
} from '../../src/modules/visits/visits.schema.js';
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
} from '../../src/modules/prescriptions/prescriptions.schema.js';
import {
  createDiagnosticReportSchema,
  updateDiagnosticReportSchema,
} from '../../src/modules/diagnostic-reports/diagnostic-reports.schema.js';

describe('Phase 5 Clinical Records Unit Tests', () => {
  // ─── 1. Visits Schemas ──────────────────────────────────────
  describe('Visit Schemas', () => {
    it('validates appointmentId UUID on create', () => {
      expect(createVisitSchema.safeParse({ appointmentId: '00000000-0000-0000-0000-000000000001' }).success).toBe(true);
      expect(createVisitSchema.safeParse({ appointmentId: 'invalid-uuid' }).success).toBe(false);
    });

    it('accepts valid clinical notes', () => {
      const valid = {
        chiefComplaint: 'Severe migraine for 3 days',
        clinicalNotes: 'Pupils equal, reactive to light. No focal deficits.',
      };
      expect(updateVisitNotesSchema.safeParse(valid).success).toBe(true);
    });
  });

  // ─── 2. Prescriptions Schemas ───────────────────────────────
  describe('Prescription Schemas', () => {
    it('validates compliant prescription with durationDays between 1 and 365', () => {
      const valid = {
        medication: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Three times daily',
        durationDays: 7,
        instructions: 'Take after meals',
      };
      expect(createPrescriptionSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects durationDays < 1', () => {
      const invalid = {
        medication: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Three times daily',
        durationDays: 0,
      };
      expect(createPrescriptionSchema.safeParse(invalid).success).toBe(false);
    });

    it('rejects durationDays > 365', () => {
      const invalid = {
        medication: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Three times daily',
        durationDays: 400,
      };
      expect(createPrescriptionSchema.safeParse(invalid).success).toBe(false);
    });

    it('rejects empty medication or dosage', () => {
      expect(createPrescriptionSchema.safeParse({ medication: '', dosage: '500mg', frequency: 'daily', durationDays: 5 }).success).toBe(false);
      expect(createPrescriptionSchema.safeParse({ medication: 'Aspirin', dosage: '', frequency: 'daily', durationDays: 5 }).success).toBe(false);
    });
  });

  // ─── 3. Diagnostic Reports Schemas ──────────────────────────
  describe('Diagnostic Report Schemas', () => {
    it('validates report ordering', () => {
      const valid = {
        reportType: '12-Lead ECG',
        fileReference: 'RAD-REF-9921',
      };
      expect(createDiagnosticReportSchema.safeParse(valid).success).toBe(true);
    });

    it('requires resultSummary when marking report as COMPLETED', () => {
      expect(
        updateDiagnosticReportSchema.safeParse({
          status: 'COMPLETED',
          resultSummary: 'Normal sinus rhythm at 72 bpm. No ST elevation.',
        }).success,
      ).toBe(true);

      expect(
        updateDiagnosticReportSchema.safeParse({
          status: 'COMPLETED',
          resultSummary: '   ', // empty string
        }).success,
      ).toBe(false);
    });

    it('allows CANCELLED report without resultSummary', () => {
      expect(
        updateDiagnosticReportSchema.safeParse({
          status: 'CANCELLED',
        }).success,
      ).toBe(true);
    });
  });
});


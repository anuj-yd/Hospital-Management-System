import { describe, it, expect } from '@jest/globals';
import {
  APPOINTMENT_TRANSITIONS,
  isValidAppointmentTransition,
} from '../../src/common/constants/statuses.js';
import {
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  cancelAppointmentSchema,
  getSlotsQuerySchema,
} from '../../src/modules/appointments/appointments.schema.js';

describe('Appointments Unit Tests (Statuses & Schema Validation)', () => {
  // ─── 1. State Transitions ───────────────────────────────────
  describe('Central Transition Map (statuses.js)', () => {
    it('allows valid transitions from SCHEDULED', () => {
      expect(isValidAppointmentTransition('SCHEDULED', 'CHECKED_IN')).toBe(true);
      expect(isValidAppointmentTransition('SCHEDULED', 'CANCELLED')).toBe(true);
      expect(isValidAppointmentTransition('SCHEDULED', 'NO_SHOW')).toBe(true);
    });

    it('rejects invalid direct transitions from SCHEDULED', () => {
      expect(isValidAppointmentTransition('SCHEDULED', 'COMPLETED')).toBe(false);
    });

    it('allows valid transitions from CHECKED_IN', () => {
      expect(isValidAppointmentTransition('CHECKED_IN', 'COMPLETED')).toBe(true);
      expect(isValidAppointmentTransition('CHECKED_IN', 'CANCELLED')).toBe(true);
    });

    it('enforces terminal status immutability', () => {
      expect(APPOINTMENT_TRANSITIONS.COMPLETED).toEqual([]);
      expect(APPOINTMENT_TRANSITIONS.CANCELLED).toEqual([]);
      expect(APPOINTMENT_TRANSITIONS.NO_SHOW).toEqual([]);

      expect(isValidAppointmentTransition('COMPLETED', 'SCHEDULED')).toBe(false);
      expect(isValidAppointmentTransition('CANCELLED', 'SCHEDULED')).toBe(false);
      expect(isValidAppointmentTransition('NO_SHOW', 'SCHEDULED')).toBe(false);
    });
  });

  // ─── 2. Schema Validation ───────────────────────────────────
  describe('Appointment Schemas', () => {
    it('accepts valid appointment creation payload', () => {
      const valid = {
        patientId: '40000000-0000-0000-0000-000000000001',
        doctorId: '30000000-0000-0000-0000-000000000001',
        startTime: '2026-11-10T09:00:00.000Z',
        reason: 'Regular cardiac follow-up',
      };
      const result = createAppointmentSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUIDs in creation', () => {
      const invalid = {
        patientId: 'not-a-uuid',
        doctorId: '30000000-0000-0000-0000-000000000001',
        startTime: '2026-11-10T09:00:00.000Z',
      };
      expect(createAppointmentSchema.safeParse(invalid).success).toBe(false);
    });

    it('validates reschedule payload', () => {
      expect(
        rescheduleAppointmentSchema.safeParse({
          newStartTime: '2026-11-12T10:00:00.000Z',
          reason: 'Patient requested afternoon',
        }).success,
      ).toBe(true);

      expect(
        rescheduleAppointmentSchema.safeParse({
          newStartTime: 'invalid-time',
        }).success,
      ).toBe(false);
    });

    it('requires cancelReason for cancellation', () => {
      expect(cancelAppointmentSchema.safeParse({ cancelReason: 'Patient emergency' }).success).toBe(true);
      expect(cancelAppointmentSchema.safeParse({ cancelReason: '   ' }).success).toBe(false);
      expect(cancelAppointmentSchema.safeParse({}).success).toBe(false);
    });

    it('validates slot date query parameter', () => {
      expect(getSlotsQuerySchema.safeParse({ date: '2026-11-10' }).success).toBe(true);
      expect(getSlotsQuerySchema.safeParse({ from: '2026-11-10', to: '2026-11-15' }).success).toBe(true);
      expect(getSlotsQuerySchema.safeParse({ date: '10-11-2026' }).success).toBe(false);
    });
  });
});


import { describe, it, expect } from '@jest/globals';
import { createUserSchema, updateUserSchema, resetPasswordSchema } from '../../src/modules/users/users.schema.js';
import { createDepartmentSchema, updateDepartmentSchema } from '../../src/modules/departments/departments.schema.js';
import { createDoctorSchema, updateDoctorSchema } from '../../src/modules/doctors/doctors.schema.js';
import { scheduleItemSchema } from '../../src/modules/schedules/schedules.schema.js';
import { createPatientSchema } from '../../src/modules/patients/patients.schema.js';

describe('Phase 3 Directory Unit Tests (Validation & Business Rules)', () => {
  // ─── 1. Users Validation ────────────────────────────────────
  describe('Users Schema', () => {
    it('accepts valid user creation payload', () => {
      const valid = {
        email: 'doctor.test@hms.local',
        password: 'Password@123',
        fullName: 'Dr. Jane Watson',
        role: 'CLINICIAN',
      };
      const result = createUserSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects short passwords', () => {
      const invalid = {
        email: 'doc@hms.local',
        password: 'short',
        fullName: 'Jane Doe',
        role: 'ADMIN',
      };
      const result = createUserSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid role', () => {
      const invalid = {
        email: 'doc@hms.local',
        password: 'Password@123',
        fullName: 'Jane Doe',
        role: 'SUPERUSER',
      };
      const result = createUserSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('validates password reset schema', () => {
      expect(resetPasswordSchema.safeParse({ newPassword: 'NewPassword@999' }).success).toBe(true);
      expect(resetPasswordSchema.safeParse({ newPassword: 'short' }).success).toBe(false);
    });
  });

  // ─── 2. Departments Validation ──────────────────────────────
  describe('Departments Schema', () => {
    it('accepts valid department payload', () => {
      const result = createDepartmentSchema.safeParse({
        name: 'Neurology',
        description: 'Brain & nerve care',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty department name', () => {
      const result = createDepartmentSchema.safeParse({ name: '   ' });
      expect(result.success).toBe(false);
    });
  });

  // ─── 3. Doctors Validation ──────────────────────────────────
  describe('Doctors Schema', () => {
    it('accepts valid doctor creation payload', () => {
      const result = createDoctorSchema.safeParse({
        departmentId: '20000000-0000-0000-0000-000000000001',
        specialization: 'Cardiology',
        licenseNumber: 'LIC-CARD-2026',
        slotDurationMin: 30,
        consultationFee: 1500,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative consultation fee', () => {
      const result = createDoctorSchema.safeParse({
        departmentId: '20000000-0000-0000-0000-000000000001',
        specialization: 'Cardiology',
        licenseNumber: 'LIC-CARD-2026',
        consultationFee: -100,
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── 4. Schedules Validation ────────────────────────────────
  describe('Schedules Schema', () => {
    it('accepts valid schedule window', () => {
      const result = scheduleItemSchema.safeParse({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '13:00',
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects when startTime is greater than or equal to endTime', () => {
      const result = scheduleItemSchema.safeParse({
        dayOfWeek: 1,
        startTime: '13:00',
        endTime: '09:00',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid dayOfWeek (< 0 or > 6)', () => {
      expect(scheduleItemSchema.safeParse({ dayOfWeek: -1, startTime: '09:00', endTime: '10:00' }).success).toBe(false);
      expect(scheduleItemSchema.safeParse({ dayOfWeek: 7, startTime: '09:00', endTime: '10:00' }).success).toBe(false);
    });
  });

  // ─── 5. Patients Validation ─────────────────────────────────
  describe('Patients Schema', () => {
    it('accepts compliant patient demographics', () => {
      const result = createPatientSchema.safeParse({
        firstName: 'Aarav',
        lastName: 'Sharma',
        dateOfBirth: '1992-04-15',
        gender: 'MALE',
        phone: '+919876543210',
        email: 'aarav@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('rejects dateOfBirth in the future', () => {
      const tomorrow = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
      const result = createPatientSchema.safeParse({
        firstName: 'Baby',
        lastName: 'Future',
        dateOfBirth: tomorrow,
        gender: 'FEMALE',
        phone: '+919876543210',
      });
      expect(result.success).toBe(false);
    });

    it('rejects malformed phone number', () => {
      const result = createPatientSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-01-01',
        gender: 'MALE',
        phone: '123', // too short
      });
      expect(result.success).toBe(false);
    });
  });
});


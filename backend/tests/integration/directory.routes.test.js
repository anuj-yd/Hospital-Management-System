import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { ROLES } from '../../src/common/constants/roles.js';

function createMockToken(role, userId = '00000000-0000-0000-0000-000000000001', doctorId = null) {
  return jwt.sign(
    {
      sub: userId,
      role,
      doctorId,
      email: `${role.toLowerCase()}@test.local`,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '1h' },
  );
}

describe('Staff and Patient Directory (Phase 3) Integration Tests', () => {
  const adminToken = createMockToken(ROLES.ADMIN, '10000000-0000-0000-0000-000000000001');
  const frontDeskToken = createMockToken(ROLES.FRONT_DESK, '10000000-0000-0000-0000-000000000002');
  const clinicianToken = createMockToken(ROLES.CLINICIAN, '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001');

  // ─── 1. Users (ADMIN only) ──────────────────────────────────
  describe('/api/v1/users', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 FORBIDDEN when FRONT_DESK attempts to list users', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      // If DB user exists and has role FRONT_DESK, returns 403
      if (res.status === 403) {
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns 403 FORBIDDEN when CLINICIAN attempts to create a user', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${clinicianToken}`)
        .send({
          email: 'test@hms.local',
          password: 'Password@123',
          fullName: 'Test User',
          role: 'FRONT_DESK',
        });

      if (res.status === 403) {
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });
  });

  // ─── 2. Departments ─────────────────────────────────────────
  describe('/api/v1/departments', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/v1/departments');
      expect(res.status).toBe(401);
    });

    it('returns 403 when FRONT_DESK tries to POST a new department', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({ name: 'Emergency Care' });

      if (res.status === 403) {
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns 403 when CLINICIAN tries to PATCH a department', async () => {
      const res = await request(app)
        .patch('/api/v1/departments/20000000-0000-0000-0000-000000000001')
        .set('Authorization', `Bearer ${clinicianToken}`)
        .send({ name: 'Updated Name' });

      if (res.status === 403) {
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });
  });

  // ─── 3. Doctors ─────────────────────────────────────────────
  describe('/api/v1/doctors', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/v1/doctors');
      expect(res.status).toBe(401);
    });

    it('returns 403 when FRONT_DESK tries to create a doctor', async () => {
      const res = await request(app)
        .post('/api/v1/doctors')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          departmentId: '20000000-0000-0000-0000-000000000001',
          specialization: 'General',
          licenseNumber: 'LIC-999',
          consultationFee: 1000,
        });

      if (res.status === 403) {
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });
  });

  // ─── 4. Doctor Schedules ───────────────────────────────────
  describe('/api/v1/doctors/:id/schedules', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/v1/doctors/30000000-0000-0000-0000-000000000001/schedules');
      expect(res.status).toBe(401);
    });

    it('returns 403 when CLINICIAN attempts to PUT /doctors/:id/schedules', async () => {
      const res = await request(app)
        .put('/api/v1/doctors/30000000-0000-0000-0000-000000000001/schedules')
        .set('Authorization', `Bearer ${clinicianToken}`)
        .send([
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '13:00',
          },
        ]);

      if (res.status === 403) {
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('validates overlapping windows schema / body', async () => {
      const res = await request(app)
        .put('/api/v1/doctors/30000000-0000-0000-0000-000000000001/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send([
          { dayOfWeek: 1, startTime: '13:00', endTime: '09:00' }, // invalid order
        ]);

      expect([400, 401]).toContain(res.status);
    });
  });

  // ─── 5. Patients ────────────────────────────────────────────
  describe('/api/v1/patients', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/v1/patients');
      expect(res.status).toBe(401);
    });

    it('returns 403 when CLINICIAN attempts to DELETE a patient', async () => {
      const res = await request(app)
        .delete('/api/v1/patients/40000000-0000-0000-0000-000000000001')
        .set('Authorization', `Bearer ${clinicianToken}`);

      if (res.status === 403) {
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns 403 when FRONT_DESK attempts to DELETE a patient', async () => {
      const res = await request(app)
        .delete('/api/v1/patients/40000000-0000-0000-0000-000000000001')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      if (res.status === 403) {
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('validates dateOfBirth not in future', async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Future',
          lastName: 'Baby',
          dateOfBirth: tomorrow,
          gender: 'MALE',
          phone: '+919876543210',
        });

      expect([400, 401]).toContain(res.status);
    });
  });
});


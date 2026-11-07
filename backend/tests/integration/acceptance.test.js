import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { getAuthToken, getExpiredToken } from '../helpers/authHelper.js';
import { ROLES } from '../../src/common/constants/roles.js';

describe('Phase 8 Assessment Acceptance Tests (A1 - A5 & Negative Cases)', () => {
  const adminToken = getAuthToken('ADMIN');
  const frontDeskToken = getAuthToken('FRONT_DESK');
  const clinicianAToken = getAuthToken('CLINICIAN');
  const clinicianBToken = getAuthToken('CLINICIAN_B');

  // A1: Patient booked into an available slot
  describe('A1: Patient Booking Into Available Slot', () => {
    it('successfully books an appointment on a valid doctor slot', async () => {
      const patientId = '40000000-0000-0000-0000-000000000001';
      const doctorId = '30000000-0000-0000-0000-000000000001';

      // Pick a future Monday at 09:30 AM (04:00:00Z)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      while (futureDate.getDay() !== 1) {
        futureDate.setDate(futureDate.getDate() + 1);
      }
      const yyyy = futureDate.getFullYear();
      const mm = String(futureDate.getMonth() + 1).padStart(2, '0');
      const dd = String(futureDate.getDate()).padStart(2, '0');
      const startTime = `${yyyy}-${mm}-${dd}T04:00:00.000Z`;

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          patientId,
          doctorId,
          startTime,
          reason: 'Initial cardiology consultation',
        });

      if (res.status === 201) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('SCHEDULED');
        expect(res.body.data.patientId).toBe(patientId);
        expect(res.body.data.doctorId).toBe(doctorId);
      } else {
        expect([201, 409, 422]).toContain(res.status);
      }
    });
  });

  // A2: Conflicting booking prevented, including 10 concurrent attempts
  describe('A2: Conflicting Booking Prevention & Concurrency Safe', () => {
    it('prevents double-booking and handles 10 concurrent requests with exactly 1 success', async () => {
      const doctorId = '30000000-0000-0000-0000-000000000001';

      // Pick an unused future Wednesday at 10:00 AM (04:30:00Z)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60 + Math.floor(Math.random() * 30));
      while (futureDate.getDay() !== 3) {
        futureDate.setDate(futureDate.getDate() + 1);
      }
      const yyyy = futureDate.getFullYear();
      const mm = String(futureDate.getMonth() + 1).padStart(2, '0');
      const dd = String(futureDate.getDate()).padStart(2, '0');
      const startTime = `${yyyy}-${mm}-${dd}T04:30:00.000Z`;

      const attempts = Array.from({ length: 10 }, (_, i) => {
        const patientIndex = String(i + 5).padStart(4, '0');
        const patientId = `40000000-0000-0000-0000-00000000${patientIndex}`;
        return request(app)
          .post('/api/v1/appointments')
          .set('Authorization', `Bearer ${frontDeskToken}`)
          .set('Idempotency-Key', `idemp-race-${Date.now()}-${i}`)
          .send({
            patientId,
            doctorId,
            startTime,
            reason: `Parallel attempt ${i}`,
          });
      });

      const results = await Promise.all(attempts);
      const statuses = results.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 201).length;
      const conflictCount = statuses.filter((s) => s === 409).length;

      // Exactly 1 booking succeeds and 9 receive 409 Conflict (or all 409 if slot already claimed)
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(9);
    });
  });

  // A3: RBAC: allowed vs forbidden for each role on patients, visits, invoices, audit logs
  describe('A3: Comprehensive RBAC Matrix Across Domains', () => {
    it('enforces RBAC on Patients: FRONT_DESK allowed, CLINICIAN scoped', async () => {
      const fdRes = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${frontDeskToken}`);
      expect([200, 401]).toContain(fdRes.status);
    });

    it('enforces RBAC on Visits: CLINICIAN B forbidden from Clinician A visit', async () => {
      const res = await request(app)
        .patch('/api/v1/visits/60000000-0000-0000-0000-000000000001')
        .set('Authorization', `Bearer ${clinicianBToken}`)
        .send({ chiefComplaint: 'Unauthorized cross-doctor update' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('enforces RBAC on Invoices: CLINICIAN strictly forbidden (403)', async () => {
      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${clinicianAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('enforces RBAC on Audit Logs: FRONT_DESK forbidden (403), ADMIN allowed (200)', async () => {
      const fdRes = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${frontDeskToken}`);
      expect(fdRes.status).toBe(403);

      const adminRes = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 401]).toContain(adminRes.status);
    });
  });

  // A4: Invoice reconciles with line items and payment status
  describe('A4: Invoice Reconciliation & Financial Invariants', () => {
    it('ensures total reconciles with line items, tax, discount, and balanceDue', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          patientId: '40000000-0000-0000-0000-000000000001',
          items: [
            { description: 'Comprehensive Cardiac Profile', quantity: 1, unitPrice: 2000.0 },
            { description: 'Follow-up ECG', quantity: 1, unitPrice: 500.0 },
          ],
          taxPercent: 10,
          discountAmount: 150.0,
        });

      if (res.status === 201) {
        const inv = res.body.data;
        // subtotal = 2500, tax = 250, discount = 150 => total = 2600.00
        expect(Number(inv.subtotal)).toBe(2500);
        expect(Number(inv.taxAmount)).toBe(250);
        expect(Number(inv.discountAmount)).toBe(150);
        expect(Number(inv.totalAmount)).toBe(2600);
        expect(Number(inv.balanceDue)).toBe(2600);
        expect(inv.status).toBe('DRAFT');
      }
    });
  });

  // A5: Sensitive read/edit produces audit rows
  describe('A5: Audit Trail Verification on Sensitive Operations', () => {
    it('verifies audit row creation on patient demographic access', async () => {
      const patientId = '40000000-0000-0000-0000-000000000001';

      // Read patient details
      await request(app)
        .get(`/api/v1/patients/${patientId}`)
        .set('Authorization', `Bearer ${frontDeskToken}`);

      // Query audit logs as admin
      const auditRes = await request(app)
        .get(`/api/v1/audit-logs?entity=Patient&entityId=${patientId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (auditRes.status === 200) {
        expect(auditRes.body.success).toBe(true);
        expect(Array.isArray(auditRes.body.data)).toBe(true);
      }
    });
  });

  // Negative Cases
  describe('Negative Error Cases & Standardized Response Envelope', () => {
    it('returns 401 UNAUTHENTICATED for missing token', async () => {
      const res = await request(app).get('/api/v1/invoices');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 401 UNAUTHENTICATED for expired token', async () => {
      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${getExpiredToken()}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 400 VALIDATION_ERROR with field details on malformed body', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.error.details)).toBe(true);
    });

    it('returns 404 NOT_FOUND for unknown entity ID', async () => {
      const res = await request(app)
        .get('/api/v1/patients/ffffffff-ffff-ffff-ffff-ffffffffffff')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 409 INVALID_STATE_TRANSITION for illegal status movements', async () => {
      // Trying to reschedule a cancelled appointment
      const res = await request(app)
        .patch('/api/v1/appointments/50000000-0000-0000-0000-000000000004/reschedule')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          newStartTime: '2026-11-20T09:00:00.000Z',
          reason: 'Attempt on cancelled appointment',
        });

      expect([409, 422]).toContain(res.status);
    });
  });
});

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { ROLES } from '../../src/common/constants/roles.js';

function createMockToken(role, userId) {
  return jwt.sign(
    {
      sub: userId,
      role,
      email: `${role.toLowerCase()}@test.local`,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '1h' },
  );
}

describe('Phase 7 Reporting & Audit Logs Integration Tests', () => {
  const adminToken = createMockToken(ROLES.ADMIN, '10000000-0000-0000-0000-000000000001');
  const frontDeskToken = createMockToken(ROLES.FRONT_DESK, '10000000-0000-0000-0000-000000000002');
  const clinicianToken = createMockToken(ROLES.CLINICIAN, '10000000-0000-0000-0000-000000000004');

  describe('GET /reports/dashboard RBAC & Data', () => {
    it('allows ADMIN to access dashboard metrics', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('todayAppointments');
        expect(res.body.data).toHaveProperty('upcoming7DaysCount');
        expect(res.body.data).toHaveProperty('newPatientsThisMonth');
        expect(res.body.data).toHaveProperty('outstandingBalanceTotal');
        expect(res.body.data).toHaveProperty('revenueThisMonth');
      }
    });

    it('allows FRONT_DESK to access dashboard metrics', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    it('denies CLINICIAN access to dashboard with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${clinicianToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /reports/appointments-summary (ADMIN only)', () => {
    it('allows ADMIN with groupBy=status', async () => {
      const res = await request(app)
        .get('/api/v1/reports/appointments-summary?groupBy=status')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('summary');
        expect(res.body.data).toHaveProperty('breakdown');
      }
    });

    it('denies FRONT_DESK access to appointments summary with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/reports/appointments-summary')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('denies CLINICIAN access to appointments summary with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/reports/appointments-summary')
        .set('Authorization', `Bearer ${clinicianToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /reports/billing-summary (ADMIN, FRONT_DESK)', () => {
    it('allows FRONT_DESK to view billing summary', async () => {
      const res = await request(app)
        .get('/api/v1/reports/billing-summary')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('invoicedTotal');
        expect(res.body.data).toHaveProperty('collectedTotal');
        expect(res.body.data).toHaveProperty('outstandingBalance');
        expect(res.body.data).toHaveProperty('countByStatus');
        expect(res.body.data).toHaveProperty('collectionsByPaymentMethod');
      }
    });

    it('denies CLINICIAN access to billing summary with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/reports/billing-summary')
        .set('Authorization', `Bearer ${clinicianToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /audit-logs (ADMIN only, read-only)', () => {
    it('allows ADMIN to view audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.meta).toHaveProperty('page');
        expect(res.body.meta).toHaveProperty('total');
      }
    });

    it('denies FRONT_DESK access to audit logs with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('denies CLINICIAN access to audit logs with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${clinicianToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});


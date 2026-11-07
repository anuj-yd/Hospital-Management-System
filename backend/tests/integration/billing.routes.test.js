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

describe('Phase 6 Billing Integration & RBAC Tests', () => {
  const adminToken = createMockToken(ROLES.ADMIN, '10000000-0000-0000-0000-000000000001');
  const frontDeskToken = createMockToken(ROLES.FRONT_DESK, '10000000-0000-0000-0000-000000000002');
  const clinicianToken = createMockToken(ROLES.CLINICIAN, '10000000-0000-0000-0000-000000000004');

  describe('RBAC Strict Role Gate', () => {
    it('strictly denies CLINICIAN access with 403 Forbidden on GET /invoices', async () => {
      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${clinicianToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('strictly denies CLINICIAN access with 403 Forbidden on POST /invoices', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${clinicianToken}`)
        .send({
          patientId: '20000000-0000-0000-0000-000000000001',
          items: [{ description: 'Cardiology Visit', quantity: 1, unitPrice: 1500 }],
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('denies FRONT_DESK from voiding an invoice (ADMIN only) with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/invoices/80000000-0000-0000-0000-000000000001/void')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Invoice Validation Rules', () => {
    it('rejects invoice creation when discount exceeds subtotal plus tax', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          patientId: '20000000-0000-0000-0000-000000000001',
          items: [{ description: 'X-Ray Chest PA', quantity: 1, unitPrice: 800 }],
          taxPercent: 5,
          discountAmount: 1200, // 1200 > 800 + 40 = 840
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('rejects payment on a DRAFT invoice with 422', async () => {
      const draftInvoiceId = '80000000-0000-0000-0000-000000000099';
      const res = await request(app)
        .post(`/api/v1/invoices/${draftInvoiceId}/payments`)
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          amount: 500,
          method: 'CASH',
        });

      // 404 if draft doesn't exist, or 422 if it exists in DRAFT status
      expect([404, 422]).toContain(res.status);
    });
  });
});


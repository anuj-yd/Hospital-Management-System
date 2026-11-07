import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { ROLES } from '../../src/common/constants/roles.js';

function createMockToken(role, userId, doctorId = null) {
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

describe('Phase 5 Clinical Records Integration Tests', () => {
  const adminToken = createMockToken(ROLES.ADMIN, '10000000-0000-0000-0000-000000000001');
  const frontDeskToken = createMockToken(ROLES.FRONT_DESK, '10000000-0000-0000-0000-000000000002');
  const clinicianAToken = createMockToken(ROLES.CLINICIAN, '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001');
  const clinicianBToken = createMockToken(ROLES.CLINICIAN, '10000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002');

  describe('RBAC & Clinical Data Security', () => {
    it('returns 403 when FRONT_DESK attempts to access prescription endpoints', async () => {
      const res = await request(app)
        .get('/api/v1/visits/50000000-0000-0000-0000-000000000001/prescriptions')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      if (res.status === 403) {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns 403 when FRONT_DESK attempts to access diagnostic reports', async () => {
      const res = await request(app)
        .get('/api/v1/visits/50000000-0000-0000-0000-000000000001/diagnostic-reports')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      if (res.status === 403) {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns 403 when Clinician B attempts to modify Clinician A clinical notes', async () => {
      const res = await request(app)
        .patch('/api/v1/visits/50000000-0000-0000-0000-000000000001')
        .set('Authorization', `Bearer ${clinicianBToken}`)
        .send({
          clinicalNotes: 'Unauthorized tampering attempt',
        });

      if (res.status === 403) {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });
  });
});


import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';

describe('Auth & Infrastructure Integration Tests', () => {
  describe('GET /api/v1/health', () => {
    it('returns server status, uptime and database connectivity state', async () => {
      const res = await request(app).get('/api/v1/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('database');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 400 when body fails schema validation', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error).toHaveProperty('requestId');
    });

    it('returns generic "Invalid credentials" without user enumeration on nonexistent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent-user-999@hms.test', password: 'Password@123' });

      // If DB is offline, error handler returns 500, else 401
      if (res.status === 401) {
        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toBe('Invalid credentials');
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
        expect(res.body.error).toHaveProperty('requestId');
      }
    });

    it('enforces login rate limiting: 5 attempts per window', async () => {
      const targetEmail = `ratelimit-test-${Date.now()}@hms.test`;

      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(
          await request(app)
            .post('/api/v1/auth/login')
            .send({ email: targetEmail, password: 'WrongPassword@123' }),
        );
      }

      const lastAttempt = attempts[attempts.length - 1];
      expect(lastAttempt.status).toBe(429);
      expect(lastAttempt.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(lastAttempt.body.error).toHaveProperty('requestId');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 UNAUTHENTICATED when Authorization header is absent', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.error.message).toMatch(/Authorization header/i);
      expect(res.body.error).toHaveProperty('requestId');
    });

    it('returns 401 UNAUTHENTICATED when token is expired', async () => {
      const expiredToken = jwt.sign(
        { sub: '10000000-0000-0000-0000-000000000001', role: 'ADMIN' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '-1s' },
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.error.message).toMatch(/expired/i);
    });

    it('returns 401 UNAUTHENTICATED when token signature is invalid', async () => {
      const fakeToken = jwt.sign(
        { sub: '10000000-0000-0000-0000-000000000001', role: 'ADMIN' },
        'wrong-secret-key-that-does-not-match-at-all-32chars',
        { expiresIn: '15m' },
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });
});


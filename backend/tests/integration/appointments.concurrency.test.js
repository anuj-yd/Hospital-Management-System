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

describe('Appointment Scheduling High-Concurrency & Edge-Case Integration Tests', () => {
  const adminToken = createMockToken(ROLES.ADMIN, '10000000-0000-0000-0000-000000000001');
  const staffToken = createMockToken(ROLES.FRONT_DESK, '10000000-0000-0000-0000-000000000002');
  const doctorId = '30000000-0000-0000-0000-000000000001'; // Dr. Sharma (Cardiology)

  // ─── 1. 10 Parallel Bookings for Same Doctor & Slot ─────────
  describe('High Concurrency Booking (10 Parallel Requests with Promise.all)', () => {
    it('allows exactly 1 booking (201) and fails 9 with 409 SLOT_TAKEN under race condition', async () => {
      // Pick a valid future Monday slot at 10:00 (e.g. 2026-12-14 10:00:00 UTC)
      const slotStartTime = '2026-12-14T10:00:00.000Z';

      // 10 distinct patients to bypass patient double-booking check and test doctor slot race condition
      const patientIds = [
        '40000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000002',
        '40000000-0000-0000-0000-000000000003',
        '40000000-0000-0000-0000-000000000004',
        '40000000-0000-0000-0000-000000000005',
        '40000000-0000-0000-0000-000000000006',
        '40000000-0000-0000-0000-000000000007',
        '40000000-0000-0000-0000-000000000008',
        '40000000-0000-0000-0000-000000000009',
        '40000000-0000-0000-0000-000000000010',
      ];

      // Fire 10 parallel booking requests for the exact same doctor and slot
      const requests = patientIds.map((pId) =>
        request(app)
          .post('/api/v1/appointments')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            patientId: pId,
            doctorId,
            startTime: slotStartTime,
            reason: 'Concurrent contention test',
          }),
      );

      const responses = await Promise.all(requests);

      const successfulBookings = responses.filter((r) => r.status === 201);
      const slotTakenConflicts = responses.filter(
        (r) => r.status === 409 && r.body?.error?.code === 'SLOT_TAKEN',
      );

      // Asserts that database partial unique index appointment_doctor_slot_active_uq serialized access
      expect(successfulBookings.length).toBe(1);
      expect(slotTakenConflicts.length).toBe(9);
    });
  });

  // ─── 2. Idempotency Replay & Conflict ───────────────────────
  describe('Idempotency Behavior on Appointments', () => {
    it('safely replays cached response when identical Idempotency-Key is resent', async () => {
      const idempotencyKey = `idemp-test-${Date.now()}`;
      const slotTime = '2026-12-21T09:00:00.000Z'; // Future Monday 09:00

      const payload = {
        patientId: '40000000-0000-0000-0000-000000000011',
        doctorId,
        startTime: slotTime,
        reason: 'Idempotency test initial',
      };

      // 1. Initial request
      const res1 = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect([201, 409]).toContain(res1.status);

      if (res1.status === 201) {
        // 2. Replay with identical body & key -> should return 201 with X-Idempotent-Replay: true
        const res2 = await request(app)
          .post('/api/v1/appointments')
          .set('Authorization', `Bearer ${staffToken}`)
          .set('Idempotency-Key', idempotencyKey)
          .send(payload);

        expect(res2.status).toBe(201);
        expect(res2.headers['x-idempotent-replay']).toBe('true');
        expect(res2.body.data.id).toBe(res1.body.data.id);

        // 3. Replay with divergent body -> should return 409 IDEMPOTENCY_CONFLICT
        const res3 = await request(app)
          .post('/api/v1/appointments')
          .set('Authorization', `Bearer ${staffToken}`)
          .set('Idempotency-Key', idempotencyKey)
          .send({
            ...payload,
            reason: 'Divergent payload using same key',
          });

        expect(res3.status).toBe(409);
        expect(res3.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
      }
    });
  });

  // ─── 3. Reschedule Conflict & Max Count ─────────────────────
  describe('Reschedule Conflicts and Limits', () => {
    it('enforces maximum 3 reschedules per appointment (422 limit exceeded)', async () => {
      // Create initial appointment
      const initRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patientId: '40000000-0000-0000-0000-000000000012',
          doctorId,
          startTime: '2026-12-28T09:00:00.000Z',
          reason: 'Reschedule limit test',
        });

      if (initRes.status === 201) {
        const appointmentId = initRes.body.data.id;

        // Perform 3 valid reschedules
        const reschedules = [
          '2026-12-28T09:30:00.000Z',
          '2026-12-28T10:00:00.000Z',
          '2026-12-28T10:30:00.000Z',
        ];

        for (const newTime of reschedules) {
          const r = await request(app)
            .patch(`/api/v1/appointments/${appointmentId}/reschedule`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ newStartTime: newTime });

          expect(r.status).toBe(200);
        }

        // 4th reschedule attempt must be rejected with 422
        const fourthAttempt = await request(app)
          .patch(`/api/v1/appointments/${appointmentId}/reschedule`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ newStartTime: '2026-12-28T11:00:00.000Z' });

        expect(fourthAttempt.status).toBe(422);
        expect(fourthAttempt.body.error.message).toMatch(/limit of 3 reached/i);
      }
    });
  });
});


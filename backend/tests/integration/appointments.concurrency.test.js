import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { getAuthToken } from '../helpers/authHelper.js';
import { ROLES } from '../../src/common/constants/roles.js';

describe('Appointment Scheduling High-Concurrency & Edge-Case Integration Tests', () => {
  const staffToken = getAuthToken(ROLES.FRONT_DESK);
  const adminToken = getAuthToken(ROLES.ADMIN);

  const doctorId = '30000000-0000-0000-0000-000000000001';

  function getDynamicFutureMonday(weekOffset = 4) {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7 + Math.floor(Math.random() * 5));
    while (d.getDay() !== 1) {
      d.setDate(d.getDate() + 1);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // ─── 1. 10 Parallel Bookings for Same Doctor & Slot ─────────
  describe('High Concurrency Booking (10 Parallel Requests with Promise.all)', () => {
    it('allows exactly 1 booking (201) and fails 9 with 409 SLOT_TAKEN under race condition', async () => {
      const dateStr = getDynamicFutureMonday(10 + Math.floor(Math.random() * 10));
      // 09:30 AM IST = 04:00:00 UTC
      const slotStartTime = `${dateStr}T04:00:00.000Z`;

      // 10 distinct patients to test doctor slot race condition
      const patientIds = Array.from({ length: 10 }, (_, i) => {
        const idx = String(i + 1).padStart(4, '0');
        return `40000000-0000-0000-0000-00000000${idx}`;
      });

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

      // Asserts that database partial unique index serialized access
      expect(successfulBookings.length).toBe(1);
      expect(slotTakenConflicts.length).toBe(9);
    });
  });

  // ─── 2. Idempotency Replay & Conflict ───────────────────────
  describe('Idempotency Behavior on Appointments', () => {
    it('safely replays cached response when identical Idempotency-Key is resent', async () => {
      const idempotencyKey = `idemp-test-${Date.now()}`;
      const dateStr = getDynamicFutureMonday(25 + Math.floor(Math.random() * 5));
      const slotTime = `${dateStr}T04:30:00.000Z`; // 10:00 AM IST

      const payload = {
        patientId: '40000000-0000-0000-0000-000000000015',
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

      expect(res1.status).toBe(201);

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
    });
  });

  // ─── 3. Reschedule Limits & Conflicts ────────────────────────
  describe('Reschedule Conflicts and Limits', () => {
    it('enforces maximum 3 reschedules per appointment (422 limit exceeded)', async () => {
      const dateStr = getDynamicFutureMonday(35 + Math.floor(Math.random() * 5));
      const initialSlot = `${dateStr}T04:00:00.000Z`; // 09:30 AM IST

      // Create initial appointment
      const initRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patientId: '40000000-0000-0000-0000-000000000018',
          doctorId,
          startTime: initialSlot,
          reason: 'Reschedule limit test',
        });

      expect(initRes.status).toBe(201);
      const appointmentId = initRes.body.data.id;

      // Perform 3 valid reschedules (04:30Z = 10:00 IST, 05:00Z = 10:30 IST, 05:30Z = 11:00 IST)
      const reschedules = [
        `${dateStr}T04:30:00.000Z`,
        `${dateStr}T05:00:00.000Z`,
        `${dateStr}T05:30:00.000Z`,
      ];

      for (const newTime of reschedules) {
        const r = await request(app)
          .patch(`/api/v1/appointments/${appointmentId}/reschedule`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ newStartTime: newTime, reason: 'Patient requested time change' });

        expect(r.status).toBe(200);
      }

      // 4th reschedule attempt must be rejected with 422
      const fourthAttempt = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newStartTime: `${dateStr}T06:00:00.000Z`, reason: '4th reschedule attempt' });

      expect(fourthAttempt.status).toBe(422);
      expect(fourthAttempt.body.error.message).toMatch(/limit of 3 reached/i);
    });
  });
});

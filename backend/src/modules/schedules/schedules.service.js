import prisma from '../../infra/prisma.js';
import * as schedulesRepo from './schedules.repository.js';
import * as doctorRepo from '../doctors/doctors.repository.js';
import * as auditService from '../audit/audit.service.js';
import { NotFoundError, BusinessRuleError, ValidationError } from '../../common/errors/index.js';

/**
 * Converts a HH:mm string to minutes from midnight.
 */
function toMinutes(hhMm) {
  const [h, m] = hhMm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Get all schedules for a doctor.
 */
export async function getDoctorSchedules(doctorId) {
  const doctor = await doctorRepo.findById(doctorId);
  if (!doctor) {
    throw new NotFoundError('Doctor', doctorId);
  }

  return schedulesRepo.findByDoctorId(doctorId);
}

/**
 * Replace a doctor's weekly schedules atomically.
 * Validates:
 * 1. startTime < endTime
 * 2. No overlapping windows on the same day
 * 3. Times align to the doctor's slotDurationMin
 */
export async function replaceDoctorSchedules(doctorId, schedulesList, auditContext) {
  // 1. Verify doctor exists and get slot duration
  const doctor = await doctorRepo.findById(doctorId);
  if (!doctor) {
    throw new NotFoundError('Doctor', doctorId);
  }

  const slotDuration = doctor.slotDurationMin || 30;
  const schedules = Array.isArray(schedulesList) ? schedulesList : [];

  // Group by dayOfWeek to check overlaps and slot alignment
  const dayGroups = new Map();

  for (let idx = 0; idx < schedules.length; idx++) {
    const s = schedules[idx];
    const startM = toMinutes(s.startTime);
    const endM = toMinutes(s.endTime);

    // Rule 1: startTime < endTime
    if (startM >= endM) {
      throw new ValidationError(
        `Invalid schedule window: startTime '${s.startTime}' must be before endTime '${s.endTime}'`,
        [{ field: `schedules[${idx}]`, message: 'startTime must be strictly before endTime' }],
      );
    }

    // Rule 3: Times align to the doctor's slotDurationMin
    if (startM % slotDuration !== 0) {
      throw new BusinessRuleError(
        `Start time '${s.startTime}' does not align with doctor's slot duration of ${slotDuration} minutes`,
        [{ field: `schedules[${idx}].startTime`, message: `Must be a multiple of ${slotDuration} minutes` }],
      );
    }

    if (endM % slotDuration !== 0) {
      throw new BusinessRuleError(
        `End time '${s.endTime}' does not align with doctor's slot duration of ${slotDuration} minutes`,
        [{ field: `schedules[${idx}].endTime`, message: `Must be a multiple of ${slotDuration} minutes` }],
      );
    }

    if ((endM - startM) < slotDuration) {
      throw new BusinessRuleError(
        `Schedule window (${s.startTime} - ${s.endTime}) is shorter than doctor's minimum slot duration of ${slotDuration} minutes`,
      );
    }

    if (!dayGroups.has(s.dayOfWeek)) {
      dayGroups.set(s.dayOfWeek, []);
    }
    dayGroups.get(s.dayOfWeek).push({ index: idx, startM, endM, raw: s });
  }

  // Rule 2: No overlapping windows on the same day
  for (const [day, windows] of dayGroups.entries()) {
    // Sort windows on the same day by start time
    windows.sort((a, b) => a.startM - b.startM);

    for (let i = 0; i < windows.length - 1; i++) {
      const current = windows[i];
      const next = windows[i + 1];

      // Overlap condition: current ends after next starts
      if (current.endM > next.startM) {
        throw new BusinessRuleError(
          `Overlapping schedule windows detected on day ${day}: (${current.raw.startTime} - ${current.raw.endTime}) overlaps with (${next.raw.startTime} - ${next.raw.endTime})`,
          [
            {
              field: `schedules[${next.index}]`,
              message: `Overlaps with schedule window ${current.raw.startTime}-${current.raw.endTime}`,
            },
          ],
        );
      }
    }
  }

  // 4. Atomic transaction
  return prisma.$transaction(async (tx) => {
    const updatedSchedules = await schedulesRepo.replaceSchedules(doctorId, schedules, tx);

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'UPDATE',
      entity: 'DoctorSchedule',
      entityId: doctorId,
      changes: {
        totalSchedules: { old: null, new: updatedSchedules.length },
      },
    });

    return updatedSchedules;
  });
}


import { DateTime } from 'luxon';
import prisma from '../../infra/prisma.js';
import { env } from '../../config/env.js';
import {
  NotFoundError,
  ForbiddenError,
  BusinessRuleError,
  SlotTakenError,
  PatientDoubleBookedError,
  InvalidStateTransitionError,
  ValidationError,
} from '../../common/errors/index.js';
import { ROLES } from '../../common/constants/roles.js';
import { isValidAppointmentTransition } from '../../common/constants/statuses.js';
import { nowUtc, nowClinic, toClinicTime } from '../../common/utils/dates.js';
import { buildPagination, buildPaginationMeta, parseSortParam } from '../../common/utils/pagination.js';
import * as appointmentRepo from './appointments.repository.js';
import * as auditService from '../audit/audit.service.js';

const ALLOWED_SORT_FIELDS = ['startTime', 'createdAt', 'status'];

/**
 * Validates that requested start time falls cleanly on doctor's schedule slot in CLINIC_TZ.
 * @returns {object} { slotDuration, requestedStart, requestedEnd }
 */
async function validateSlotAgainstDoctorSchedule(doctor, startTimeInput, tx) {
  const db = tx || prisma;
  const requestedStart = new Date(startTimeInput);

  if (isNaN(requestedStart.getTime())) {
    throw new ValidationError('Invalid appointment start time format');
  }

  // Must be strictly in the future
  if (requestedStart.getTime() <= Date.now()) {
    throw new BusinessRuleError('Appointment start time must be in the future');
  }

  const slotDuration = doctor.slotDurationMin || 30;
  const requestedEnd = new Date(requestedStart.getTime() + slotDuration * 60 * 1000);

  // Convert to clinic local time to match weekly schedule
  const clinicStart = DateTime.fromJSDate(requestedStart).setZone(env.CLINIC_TZ);
  const dayOfWeek = clinicStart.weekday % 7; // 0=Sunday ... 6=Saturday
  const startHhMm = clinicStart.toFormat('HH:mm');
  const endHhMm = clinicStart.plus({ minutes: slotDuration }).toFormat('HH:mm');

  // Verify doctor has an active schedule covering this window
  const activeSchedule = await db.doctorSchedule.findFirst({
    where: {
      doctorId: doctor.id,
      dayOfWeek,
      isActive: true,
      startTime: { lte: startHhMm },
      endTime: { gte: endHhMm },
    },
  });

  if (!activeSchedule) {
    throw new BusinessRuleError(
      'Selected appointment time does not fall within doctor scheduled working hours',
      [{ field: 'startTime', message: `Doctor is not scheduled on day ${dayOfWeek} at ${startHhMm}` }],
    );
  }

  // Verify time slot alignment (multiple of slotDuration from schedule start)
  const [schedH, schedM] = activeSchedule.startTime.split(':').map(Number);
  const schedStartMinutes = schedH * 60 + schedM;
  const currentStartMinutes = clinicStart.hour * 60 + clinicStart.minute;

  if ((currentStartMinutes - schedStartMinutes) % slotDuration !== 0) {
    throw new BusinessRuleError(
      `Appointment start time (${startHhMm}) does not align with doctor slot duration of ${slotDuration} minutes`,
      [{ field: 'startTime', message: `Must align to ${slotDuration}-minute intervals from ${activeSchedule.startTime}` }],
    );
  }

  return { slotDuration, requestedStart, requestedEnd };
}

/**
 * 1. GET /doctors/:id/slots
 * Generates available slots for a doctor across date range (max 14 days).
 */
export async function getDoctorSlots(doctorId, query) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
  });

  if (!doctor) {
    throw new NotFoundError('Doctor', doctorId);
  }

  if (!doctor.isActive) {
    throw new BusinessRuleError('Cannot query slots for an inactive doctor');
  }

  // Parse date range in clinic timezone
  let fromDt;
  let toDt;

  if (query.date) {
    fromDt = DateTime.fromFormat(query.date, 'yyyy-MM-dd', { zone: env.CLINIC_TZ }).startOf('day');
    toDt = fromDt.endOf('day');
  } else if (query.from && query.to) {
    fromDt = DateTime.fromFormat(query.from, 'yyyy-MM-dd', { zone: env.CLINIC_TZ }).startOf('day');
    toDt = DateTime.fromFormat(query.to, 'yyyy-MM-dd', { zone: env.CLINIC_TZ }).endOf('day');
  } else {
    // Default to today
    fromDt = nowClinic().startOf('day');
    toDt = fromDt.endOf('day');
  }

  if (!fromDt.isValid || !toDt.isValid) {
    throw new ValidationError('Invalid date parameters. Expected format YYYY-MM-DD');
  }

  if (fromDt > toDt) {
    throw new ValidationError("'from' date cannot be after 'to' date");
  }

  const daysDiff = toDt.diff(fromDt, 'days').days;
  if (daysDiff > 14) {
    throw new ValidationError('Slot generation date range cannot exceed 14 days');
  }

  const slotDuration = doctor.slotDurationMin || 30;

  // Retrieve active schedules for this doctor
  const schedules = await prisma.doctorSchedule.findMany({
    where: { doctorId, isActive: true },
  });

  // Retrieve active booked appointments in UTC range
  const fromUtc = fromDt.toUTC().toJSDate();
  const toUtc = toDt.toUTC().toJSDate();

  const bookedAppointments = await appointmentRepo.findActiveDoctorAppointments(
    doctorId,
    fromUtc,
    toUtc,
  );

  const nowMs = Date.now();
  const availableSlots = [];

  // Iterate each day in the range
  let cursorDt = fromDt;
  while (cursorDt <= toDt) {
    const dayOfWeek = cursorDt.weekday % 7;
    const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek);

    for (const schedule of daySchedules) {
      const [startH, startM] = schedule.startTime.split(':').map(Number);
      const [endH, endM] = schedule.endTime.split(':').map(Number);

      const windowStart = cursorDt.set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
      const windowEnd = cursorDt.set({ hour: endH, minute: endM, second: 0, millisecond: 0 });

      let slotStart = windowStart;
      while (slotStart.plus({ minutes: slotDuration }) <= windowEnd) {
        const slotEnd = slotStart.plus({ minutes: slotDuration });
        const slotStartJs = slotStart.toUTC().toJSDate();
        const slotEndJs = slotEnd.toUTC().toJSDate();

        const isPast = slotStartJs.getTime() <= nowMs;
        const isOccupied = bookedAppointments.some(
          (appt) => appt.startTime < slotEndJs && appt.endTime > slotStartJs,
        );

        if (!isPast && !isOccupied) {
          availableSlots.push({
            startTime: slotStart.toUTC().toISO(),
            endTime: slotEnd.toUTC().toISO(),
            available: true,
          });
        }

        slotStart = slotEnd;
      }
    }

    cursorDt = cursorDt.plus({ days: 1 });
  }

  return availableSlots;
}

/**
 * 2. POST /appointments
 * Book a new appointment inside one prisma.$transaction.
 */
export async function createAppointment(data, auditContext) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify patient exists and is active
    const patient = await tx.patient.findUnique({ where: { id: data.patientId } });
    if (!patient) throw new NotFoundError('Patient', data.patientId);
    if (!patient.isActive) throw new BusinessRuleError('Cannot book an appointment for an inactive patient');

    // 2. Verify doctor exists and is active
    const doctor = await tx.doctor.findUnique({ where: { id: data.doctorId } });
    if (!doctor) throw new NotFoundError('Doctor', data.doctorId);
    if (!doctor.isActive) throw new BusinessRuleError('Cannot book an appointment with an inactive doctor');

    // 3. Verify schedule and slot alignment
    const { requestedStart, requestedEnd } = await validateSlotAgainstDoctorSchedule(
      doctor,
      data.startTime,
      tx,
    );

    // 4. Verify patient does not have another active overlapping appointment
    const patientConflict = await appointmentRepo.findOverlappingPatientAppointment(
      data.patientId,
      requestedStart,
      requestedEnd,
      null,
      tx,
    );

    if (patientConflict) {
      throw new PatientDoubleBookedError(
        'Patient already has an active appointment overlapping this time window',
      );
    }

    // 5. Insert appointment; rely on DB unique index appointment_doctor_slot_active_uq as source of truth
    let appointment;
    try {
      appointment = await appointmentRepo.create(
        {
          patientId: data.patientId,
          doctorId: data.doctorId,
          startTime: requestedStart,
          endTime: requestedEnd,
          status: 'SCHEDULED',
          reason: data.reason ? data.reason.trim() : null,
          createdById: auditContext.id,
        },
        tx,
      );
    } catch (err) {
      if (
        err.code === 'P2002' ||
        (err.message && err.message.includes('appointment_doctor_slot_active_uq'))
      ) {
        throw new SlotTakenError('This appointment time slot is already booked for this doctor');
      }
      throw err;
    }

    // 6. Write AppointmentHistory
    await appointmentRepo.createHistory(
      {
        appointmentId: appointment.id,
        fromStatus: null,
        toStatus: 'SCHEDULED',
        newStartTime: appointment.startTime,
        changedById: auditContext.id,
      },
      tx,
    );

    // 7. Write audit log entry in the same transaction
    await auditService.record({
      tx,
      actor: auditContext,
      action: 'CREATE',
      entity: 'Appointment',
      entityId: appointment.id,
      changes: {
        patientId: { old: null, new: appointment.patientId },
        doctorId: { old: null, new: appointment.doctorId },
        startTime: { old: null, new: appointment.startTime.toISOString() },
        status: { old: null, new: appointment.status },
      },
    });

    return appointment;
  });
}

/**
 * 3. PATCH /appointments/:id/reschedule
 * Reschedule an appointment atomically.
 */
export async function rescheduleAppointment(id, data, auditContext) {
  return prisma.$transaction(async (tx) => {
    const existing = await appointmentRepo.findById(id, tx);
    if (!existing) {
      throw new NotFoundError('Appointment', id);
    }

    // Only SCHEDULED appointments can be rescheduled
    if (existing.status !== 'SCHEDULED') {
      throw new InvalidStateTransitionError(
        'Appointment',
        existing.status,
        'SCHEDULED',
        `Cannot reschedule an appointment in '${existing.status}' status. Only SCHEDULED appointments may be rescheduled.`,
      );
    }

    // Reschedule limit check (max 3)
    if (existing.rescheduleCount >= 3) {
      throw new BusinessRuleError('Maximum reschedule limit of 3 reached for this appointment');
    }

    // Doctor verification
    const doctor = await tx.doctor.findUnique({ where: { id: existing.doctorId } });
    if (!doctor || !doctor.isActive) {
      throw new BusinessRuleError('Doctor is no longer active');
    }

    // Validate new slot
    const { requestedStart: newStart, requestedEnd: newEnd } = await validateSlotAgainstDoctorSchedule(
      doctor,
      data.newStartTime,
      tx,
    );

    // Verify patient has no conflicting active appointment (excluding current appointment)
    const patientConflict = await appointmentRepo.findOverlappingPatientAppointment(
      existing.patientId,
      newStart,
      newEnd,
      existing.id,
      tx,
    );

    if (patientConflict) {
      throw new PatientDoubleBookedError(
        'Patient already has an active appointment overlapping the new time window',
      );
    }

    // Atomic update
    let updated;
    try {
      updated = await appointmentRepo.update(
        id,
        {
          startTime: newStart,
          endTime: newEnd,
          rescheduleCount: existing.rescheduleCount + 1,
          reason: data.reason ? data.reason.trim() : existing.reason,
        },
        tx,
      );
    } catch (err) {
      if (
        err.code === 'P2002' ||
        (err.message && err.message.includes('appointment_doctor_slot_active_uq'))
      ) {
        throw new SlotTakenError('This appointment time slot is already booked for this doctor');
      }
      throw err;
    }

    // Record history
    await appointmentRepo.createHistory(
      {
        appointmentId: id,
        fromStatus: 'SCHEDULED',
        toStatus: 'SCHEDULED',
        oldStartTime: existing.startTime,
        newStartTime: updated.startTime,
        changedById: auditContext.id,
      },
      tx,
    );

    // Record audit
    await auditService.record({
      tx,
      actor: auditContext,
      action: 'UPDATE',
      entity: 'Appointment',
      entityId: id,
      changes: {
        startTime: { old: existing.startTime.toISOString(), new: updated.startTime.toISOString() },
        rescheduleCount: { old: existing.rescheduleCount, new: updated.rescheduleCount },
      },
    });

    return updated;
  });
}

/**
 * 4. POST /appointments/:id/cancel
 * Cancel an appointment (frees the slot).
 */
export async function cancelAppointment(id, data, auditContext) {
  return prisma.$transaction(async (tx) => {
    const existing = await appointmentRepo.findById(id, tx);
    if (!existing) {
      throw new NotFoundError('Appointment', id);
    }

    if (!isValidAppointmentTransition(existing.status, 'CANCELLED')) {
      throw new InvalidStateTransitionError(
        'Appointment',
        existing.status,
        'CANCELLED',
        `Cannot cancel an appointment in '${existing.status}' status`,
      );
    }

    const updated = await appointmentRepo.update(
      id,
      {
        status: 'CANCELLED',
        cancelReason: data.cancelReason.trim(),
      },
      tx,
    );

    await appointmentRepo.createHistory(
      {
        appointmentId: id,
        fromStatus: existing.status,
        toStatus: 'CANCELLED',
        oldStartTime: existing.startTime,
        newStartTime: null,
        changedById: auditContext.id,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'UPDATE',
      entity: 'Appointment',
      entityId: id,
      changes: {
        status: { old: existing.status, new: 'CANCELLED' },
        cancelReason: { old: null, new: updated.cancelReason },
      },
    });

    return updated;
  });
}

/**
 * 5. POST /appointments/:id/check-in
 * SCHEDULED -> CHECKED_IN only on appointment date in clinic timezone.
 */
export async function checkInAppointment(id, auditContext) {
  return prisma.$transaction(async (tx) => {
    const existing = await appointmentRepo.findById(id, tx);
    if (!existing) {
      throw new NotFoundError('Appointment', id);
    }

    if (!isValidAppointmentTransition(existing.status, 'CHECKED_IN')) {
      throw new InvalidStateTransitionError(
        'Appointment',
        existing.status,
        'CHECKED_IN',
        `Cannot check in an appointment in '${existing.status}' status`,
      );
    }

    // Verify appointment date matches current date in clinic timezone
    const apptClinicDate = toClinicTime(existing.startTime).toISODate();
    const todayClinicDate = nowClinic().toISODate();

    if (apptClinicDate !== todayClinicDate) {
      throw new BusinessRuleError(
        `Check-in is only permitted on the day of the appointment (${apptClinicDate}). Today is ${todayClinicDate}.`,
        [{ field: 'startTime', message: 'Not today appointment' }],
      );
    }

    const updated = await appointmentRepo.update(
      id,
      {
        status: 'CHECKED_IN',
      },
      tx,
    );

    await appointmentRepo.createHistory(
      {
        appointmentId: id,
        fromStatus: existing.status,
        toStatus: 'CHECKED_IN',
        changedById: auditContext.id,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'UPDATE',
      entity: 'Appointment',
      entityId: id,
      changes: {
        status: { old: existing.status, new: 'CHECKED_IN' },
      },
    });

    return updated;
  });
}

/**
 * 5. POST /appointments/:id/no-show
 * SCHEDULED -> NO_SHOW only after start time has passed.
 */
export async function noShowAppointment(id, auditContext) {
  return prisma.$transaction(async (tx) => {
    const existing = await appointmentRepo.findById(id, tx);
    if (!existing) {
      throw new NotFoundError('Appointment', id);
    }

    if (!isValidAppointmentTransition(existing.status, 'NO_SHOW')) {
      throw new InvalidStateTransitionError(
        'Appointment',
        existing.status,
        'NO_SHOW',
        `Cannot mark an appointment in '${existing.status}' status as NO_SHOW`,
      );
    }

    // Only allowed after scheduled start time has passed
    if (nowUtc().toMillis() < new Date(existing.startTime).getTime()) {
      throw new BusinessRuleError(
        'Cannot mark appointment as NO_SHOW before its scheduled start time has passed',
        [{ field: 'startTime', message: 'Appointment start time is still in the future' }],
      );
    }

    const updated = await appointmentRepo.update(
      id,
      {
        status: 'NO_SHOW',
      },
      tx,
    );

    await appointmentRepo.createHistory(
      {
        appointmentId: id,
        fromStatus: existing.status,
        toStatus: 'NO_SHOW',
        changedById: auditContext.id,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'UPDATE',
      entity: 'Appointment',
      entityId: id,
      changes: {
        status: { old: existing.status, new: 'NO_SHOW' },
      },
    });

    return updated;
  });
}

/**
 * 6. GET /appointments
 * List appointments with filters, pagination, sort.
 * CLINICIAN sees only their own appointments.
 */
export async function getAppointments(filters, auditContext) {
  const { page, limit, sort, doctorId, patientId, status, from, to, search, q } = filters;
  const searchTerm = (search || q || '').trim() || undefined;
  const orderBy = parseSortParam(sort, ALLOWED_SORT_FIELDS) || [{ startTime: 'desc' }];
  const { skip, take } = buildPagination(page, limit);

  let targetDoctorId = doctorId;

  // Clinician scoping: strictly restricted to their own doctor profile
  if (auditContext.role === ROLES.CLINICIAN) {
    if (!auditContext.doctorId) {
      return { data: [], meta: buildPaginationMeta(page, limit, 0) };
    }
    targetDoctorId = auditContext.doctorId;
  }

  const filterParams = {
    skip,
    take,
    orderBy,
    doctorId: targetDoctorId,
    patientId,
    status,
    from,
    to,
    search: searchTerm,
  };

  const [data, total] = await Promise.all([
    appointmentRepo.findAll(filterParams),
    appointmentRepo.count(filterParams),
  ]);

  const meta = buildPaginationMeta(page, limit, total);
  return { data, meta };
}

/**
 * 6. GET /appointments/:id
 * Retrieve appointment by ID.
 * CLINICIAN sees only their own appointments (otherwise 403).
 */
export async function getAppointmentById(id, auditContext) {
  const appointment = await appointmentRepo.findById(id);
  if (!appointment) {
    throw new NotFoundError('Appointment', id);
  }

  if (auditContext.role === ROLES.CLINICIAN) {
    if (!auditContext.doctorId || appointment.doctorId !== auditContext.doctorId) {
      throw new ForbiddenError('You do not have access to appointments for another clinician');
    }
  }

  return appointment;
}


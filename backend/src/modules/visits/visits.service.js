import prisma from '../../infra/prisma.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BusinessRuleError,
} from '../../common/errors/index.js';
import { ROLES } from '../../common/constants/roles.js';
import { buildPagination, buildPaginationMeta } from '../../common/utils/pagination.js';
import * as visitsRepo from './visits.repository.js';
import * as auditService from '../audit/audit.service.js';

/**
 * Strips clinical content (notes, prescriptions, reports) for front desk staff.
 */
function sanitizeVisitForFrontDesk(visit) {
  return {
    id: visit.id,
    appointmentId: visit.appointmentId,
    patientId: visit.patientId,
    doctorId: visit.doctorId,
    status: visit.status,
    checkInAt: visit.checkInAt,
    closedAt: visit.closedAt,
    createdAt: visit.createdAt,
    updatedAt: visit.updatedAt,
    patient: visit.patient,
    doctor: visit.doctor,
    appointment: visit.appointment,
  };
}

/**
 * 1. POST /visits { appointmentId }
 * Initiates an OPEN visit for a CHECKED_IN appointment.
 */
export async function createVisit(data, auditContext) {
  const { appointmentId } = data;

  return prisma.$transaction(async (tx) => {
    // 1. Verify appointment exists
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment', appointmentId);
    }

    // 2. Clinician ownership check
    if (auditContext.role === ROLES.CLINICIAN) {
      if (!auditContext.doctorId || appointment.doctorId !== auditContext.doctorId) {
        throw new ForbiddenError('You can only initiate clinical visits for your own appointments');
      }
    }

    // 3. Appointment must be in CHECKED_IN status
    if (appointment.status !== 'CHECKED_IN') {
      throw new BusinessRuleError(
        `Appointment must be in CHECKED_IN status to initiate a clinical visit. Current status is '${appointment.status}'.`,
        [{ field: 'appointmentId', message: 'Appointment is not checked in' }],
      );
    }

    // 4. One visit per appointment (unique)
    const existingVisit = await visitsRepo.findByAppointmentId(appointmentId, tx);
    if (existingVisit) {
      throw new ConflictError('A clinical visit has already been initiated for this appointment');
    }

    // 5. Create OPEN visit
    const created = await visitsRepo.create(
      {
        appointmentId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        status: 'OPEN',
        checkInAt: new Date(),
      },
      tx,
    );

    // 6. Audit creation
    await auditService.record({
      tx,
      actor: auditContext,
      action: 'CREATE',
      entity: 'Visit',
      entityId: created.id,
      changes: {
        appointmentId: { old: null, new: created.appointmentId },
        patientId: { old: null, new: created.patientId },
        doctorId: { old: null, new: created.doctorId },
        status: { old: null, new: 'OPEN' },
      },
    });

    return created;
  });
}

/**
 * 2. GET /visits/:id
 * Scoped access: CLINICIAN (own only -> 403), ADMIN (full), FRONT_DESK (metadata only).
 * Every read of clinical content is audited.
 */
export async function getVisitById(id, auditContext) {
  const visit = await visitsRepo.findById(id);
  if (!visit) {
    throw new NotFoundError('Visit', id);
  }

  // Clinician scoping: own visits only
  if (auditContext.role === ROLES.CLINICIAN) {
    if (!auditContext.doctorId || visit.doctorId !== auditContext.doctorId) {
      throw new ForbiddenError('You do not have permission to view visits of another clinician');
    }
  }

  // Front Desk: metadata only (clinical fields stripped)
  if (auditContext.role === ROLES.FRONT_DESK) {
    return sanitizeVisitForFrontDesk(visit);
  }

  // Audit read of clinical record (for ADMIN and CLINICIAN)
  await auditService.record({
    actor: auditContext,
    action: 'READ',
    entity: 'Visit',
    entityId: id,
    changes: {
      patientId: visit.patientId,
      status: visit.status,
    },
  });

  return visit;
}

/**
 * 2. GET /patients/:patientId/visits
 * List visits for a patient (paginated).
 */
export async function getPatientVisits(patientId, query, auditContext) {
  const { page, limit, status } = query;
  const { skip, take } = buildPagination(page, limit);

  let targetDoctorId;
  if (auditContext.role === ROLES.CLINICIAN) {
    targetDoctorId = auditContext.doctorId;
  }

  const filterParams = {
    patientId,
    doctorId: targetDoctorId,
    status,
    skip,
    take,
  };

  const [data, total] = await Promise.all([
    visitsRepo.findAllByPatientId(filterParams),
    visitsRepo.countByPatientId(filterParams),
  ]);

  // Strip clinical content for Front Desk
  const results =
    auditContext.role === ROLES.FRONT_DESK
      ? data.map(sanitizeVisitForFrontDesk)
      : data;

  // Audit read if clinical content is accessed
  if (auditContext.role !== ROLES.FRONT_DESK && data.length > 0) {
    await auditService.record({
      actor: auditContext,
      action: 'READ',
      entity: 'PatientVisits',
      entityId: patientId,
      changes: { totalViewed: data.length },
    });
  }

  const meta = buildPaginationMeta(page, limit, total);
  return { data: results, meta };
}

/**
 * 3. PATCH /visits/:id { chiefComplaint, clinicalNotes }
 * Only while OPEN and only by owning clinician.
 * Audit stores changed field NAMES, not narrative note text.
 */
export async function updateVisitNotes(id, data, auditContext) {
  const visit = await visitsRepo.findById(id);
  if (!visit) {
    throw new NotFoundError('Visit', id);
  }

  // Ownership: only by owning clinician (or ADMIN)
  if (auditContext.role === ROLES.CLINICIAN) {
    if (!auditContext.doctorId || visit.doctorId !== auditContext.doctorId) {
      throw new ForbiddenError('Only the owning clinician can modify clinical notes for this visit');
    }
  }

  // Immutability: only while OPEN
  if (visit.status !== 'OPEN') {
    throw new ConflictError('Cannot modify a closed visit. Closed visits are immutable.');
  }

  const updateData = {};
  if (data.chiefComplaint !== undefined) updateData.chiefComplaint = data.chiefComplaint ? data.chiefComplaint.trim() : null;
  if (data.clinicalNotes !== undefined) updateData.clinicalNotes = data.clinicalNotes ? data.clinicalNotes.trim() : null;

  const modifiedFieldNames = Object.keys(updateData);
  if (modifiedFieldNames.length === 0) {
    return visit;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await visitsRepo.update(id, updateData, tx);

    // Audit stores changed field NAMES, not the note text (HIPAA/Privacy requirement)
    await auditService.record({
      tx,
      actor: auditContext,
      action: 'UPDATE',
      entity: 'Visit',
      entityId: id,
      changes: {
        modifiedFields: modifiedFieldNames,
      },
    });

    return updated;
  });
}

/**
 * 4. POST /visits/:id/close
 * OPEN -> CLOSED, sets closedAt, and moves appointment CHECKED_IN -> COMPLETED in same transaction.
 * Closed visit becomes immutable.
 */
export async function closeVisit(id, auditContext) {
  return prisma.$transaction(async (tx) => {
    const visit = await visitsRepo.findById(id, tx);
    if (!visit) {
      throw new NotFoundError('Visit', id);
    }

    if (visit.status !== 'OPEN') {
      throw new ConflictError('Cannot close a visit that is not currently OPEN');
    }

    // Ownership: owning clinician or ADMIN
    if (auditContext.role === ROLES.CLINICIAN) {
      if (!auditContext.doctorId || visit.doctorId !== auditContext.doctorId) {
        throw new ForbiddenError('Only the owning clinician can close this visit');
      }
    }

    const closedAt = new Date();

    // 1. Close the visit
    const updatedVisit = await visitsRepo.update(
      id,
      {
        status: 'CLOSED',
        closedAt,
      },
      tx,
    );

    // 2. Move appointment to COMPLETED atomically
    await tx.appointment.update({
      where: { id: visit.appointmentId },
      data: {
        status: 'COMPLETED',
      },
    });

    // 3. Write appointment history
    await tx.appointmentHistory.create({
      data: {
        appointmentId: visit.appointmentId,
        fromStatus: 'CHECKED_IN',
        toStatus: 'COMPLETED',
        changedById: auditContext.id,
      },
    });

    // 4. Audit visit status change
    await auditService.record({
      tx,
      actor: auditContext,
      action: 'STATUS_CHANGE',
      entity: 'Visit',
      entityId: id,
      changes: {
        status: { old: 'OPEN', new: 'CLOSED' },
        closedAt: { old: null, new: closedAt.toISOString() },
      },
    });

    return updatedVisit;
  });
}


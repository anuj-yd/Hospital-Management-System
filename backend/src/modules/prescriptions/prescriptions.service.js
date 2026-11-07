import prisma from '../../infra/prisma.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../common/errors/index.js';
import { ROLES } from '../../common/constants/roles.js';
import * as prescriptionsRepo from './prescriptions.repository.js';
import * as visitsRepo from '../visits/visits.repository.js';
import * as auditService from '../audit/audit.service.js';

function checkVisitAndOwnership(visit, auditContext, actionDescription) {
  if (visit.status !== 'OPEN') {
    throw new ConflictError(
      `Cannot ${actionDescription} for a closed visit. Closed visits are immutable.`,
    );
  }

  if (auditContext.role === ROLES.CLINICIAN) {
    if (!auditContext.doctorId || visit.doctorId !== auditContext.doctorId) {
      throw new ForbiddenError(
        `Only the clinician who conducted this visit can ${actionDescription}`,
      );
    }
  }
}

/**
 * POST /visits/:id/prescriptions
 */
export async function addPrescription(visitId, data, auditContext) {
  const visit = await visitsRepo.findById(visitId);
  if (!visit) {
    throw new NotFoundError('Visit', visitId);
  }

  checkVisitAndOwnership(visit, auditContext, 'add prescriptions');

  return prisma.$transaction(async (tx) => {
    const created = await prescriptionsRepo.create(
      {
        visitId,
        medication: data.medication.trim(),
        dosage: data.dosage.trim(),
        frequency: data.frequency.trim(),
        durationDays: data.durationDays,
        instructions: data.instructions ? data.instructions.trim() : null,
        prescribedById: auditContext.id,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'CREATE',
      entity: 'Prescription',
      entityId: created.id,
      changes: {
        visitId: { old: null, new: visitId },
        medication: { old: null, new: created.medication },
        dosage: { old: null, new: created.dosage },
        durationDays: { old: null, new: created.durationDays },
      },
    });

    return created;
  });
}

/**
 * GET /visits/:id/prescriptions
 */
export async function getVisitPrescriptions(visitId, auditContext) {
  const visit = await visitsRepo.findById(visitId);
  if (!visit) {
    throw new NotFoundError('Visit', visitId);
  }

  // Front desk cannot access clinical prescriptions
  if (auditContext.role === ROLES.FRONT_DESK) {
    throw new ForbiddenError('Front desk staff cannot access prescription details');
  }

  // Clinician scoping: own visits only
  if (auditContext.role === ROLES.CLINICIAN) {
    if (!auditContext.doctorId || visit.doctorId !== auditContext.doctorId) {
      throw new ForbiddenError('You do not have access to prescriptions for another clinician visit');
    }
  }

  const prescriptions = await prescriptionsRepo.findByVisitId(visitId);

  // Audit read of clinical prescription details
  await auditService.record({
    actor: auditContext,
    action: 'READ',
    entity: 'VisitPrescriptions',
    entityId: visitId,
    changes: { totalViewed: prescriptions.length },
  });

  return prescriptions;
}

/**
 * PATCH /prescriptions/:id
 */
export async function updatePrescription(id, data, auditContext) {
  const prescription = await prescriptionsRepo.findById(id);
  if (!prescription) {
    throw new NotFoundError('Prescription', id);
  }

  checkVisitAndOwnership(prescription.visit, auditContext, 'modify prescriptions');

  const updateData = {};
  if (data.medication !== undefined) updateData.medication = data.medication.trim();
  if (data.dosage !== undefined) updateData.dosage = data.dosage.trim();
  if (data.frequency !== undefined) updateData.frequency = data.frequency.trim();
  if (data.durationDays !== undefined) updateData.durationDays = data.durationDays;
  if (data.instructions !== undefined) {
    updateData.instructions = data.instructions ? data.instructions.trim() : null;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await prescriptionsRepo.update(id, updateData, tx);

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'UPDATE',
      entity: 'Prescription',
      entityId: id,
      changes: {
        modifiedFields: Object.keys(updateData),
      },
    });

    return updated;
  });
}

/**
 * DELETE /prescriptions/:id
 */
export async function deletePrescription(id, auditContext) {
  const prescription = await prescriptionsRepo.findById(id);
  if (!prescription) {
    throw new NotFoundError('Prescription', id);
  }

  checkVisitAndOwnership(prescription.visit, auditContext, 'delete prescriptions');

  return prisma.$transaction(async (tx) => {
    await prescriptionsRepo.remove(id, tx);

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'DELETE',
      entity: 'Prescription',
      entityId: id,
      changes: {
        medication: { old: prescription.medication, new: null },
      },
    });

    return { message: 'Prescription deleted successfully' };
  });
}


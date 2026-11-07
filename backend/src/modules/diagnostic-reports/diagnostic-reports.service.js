import prisma from '../../infra/prisma.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  InvalidStateTransitionError,
} from '../../common/errors/index.js';
import { ROLES } from '../../common/constants/roles.js';
import * as reportsRepo from './diagnostic-reports.repository.js';
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
 * POST /visits/:id/diagnostic-reports
 * Orders a diagnostic test / report (metadata only, no file upload).
 */
export async function orderReport(visitId, data, auditContext) {
  const visit = await visitsRepo.findById(visitId);
  if (!visit) {
    throw new NotFoundError('Visit', visitId);
  }

  checkVisitAndOwnership(visit, auditContext, 'order diagnostic reports');

  return prisma.$transaction(async (tx) => {
    const created = await reportsRepo.create(
      {
        visitId,
        reportType: data.reportType.trim(),
        status: 'ORDERED',
        resultSummary: data.resultSummary ? data.resultSummary.trim() : null,
        fileReference: data.fileReference ? data.fileReference.trim() : null,
        orderedById: auditContext.id,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'CREATE',
      entity: 'DiagnosticReport',
      entityId: created.id,
      changes: {
        visitId: { old: null, new: visitId },
        reportType: { old: null, new: created.reportType },
        status: { old: null, new: 'ORDERED' },
      },
    });

    return created;
  });
}

/**
 * GET /visits/:id/diagnostic-reports
 */
export async function getVisitReports(visitId, auditContext) {
  const visit = await visitsRepo.findById(visitId);
  if (!visit) {
    throw new NotFoundError('Visit', visitId);
  }

  // Front desk cannot access clinical diagnostic reports
  if (auditContext.role === ROLES.FRONT_DESK) {
    throw new ForbiddenError('Front desk staff cannot access diagnostic report details');
  }

  // Clinician scoping: own visits only
  if (auditContext.role === ROLES.CLINICIAN) {
    if (!auditContext.doctorId || visit.doctorId !== auditContext.doctorId) {
      throw new ForbiddenError('You do not have access to diagnostic reports for another clinician visit');
    }
  }

  const reports = await reportsRepo.findByVisitId(visitId);

  // Audit read of clinical diagnostic report details
  await auditService.record({
    actor: auditContext,
    action: 'READ',
    entity: 'VisitDiagnosticReports',
    entityId: visitId,
    changes: { totalViewed: reports.length },
  });

  return reports;
}

/**
 * PATCH /diagnostic-reports/:id
 * ORDERED -> COMPLETED (with resultSummary text typed by clinician)
 * ORDERED -> CANCELLED
 */
export async function updateReport(id, data, auditContext) {
  const report = await reportsRepo.findById(id);
  if (!report) {
    throw new NotFoundError('DiagnosticReport', id);
  }

  // Clinician ownership check
  if (auditContext.role === ROLES.CLINICIAN) {
    if (!auditContext.doctorId || report.visit.doctorId !== auditContext.doctorId) {
      throw new ForbiddenError(
        'Only the clinician who conducted this visit can update this diagnostic report',
      );
    }
  }

  // Valid state transitions
  if (report.status !== 'ORDERED') {
    throw new InvalidStateTransitionError(
      'DiagnosticReport',
      report.status,
      data.status,
      `Cannot transition diagnostic report from '${report.status}' to '${data.status}'. Only ORDERED reports can be updated.`,
    );
  }

  const updateData = {
    status: data.status,
  };

  if (data.status === 'COMPLETED') {
    updateData.completedAt = new Date();
    updateData.resultSummary = data.resultSummary.trim();
  }

  if (data.fileReference !== undefined) {
    updateData.fileReference = data.fileReference ? data.fileReference.trim() : null;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await reportsRepo.update(id, updateData, tx);

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'STATUS_CHANGE',
      entity: 'DiagnosticReport',
      entityId: id,
      changes: {
        status: { old: report.status, new: updated.status },
        hasResultSummary: Boolean(updated.resultSummary),
      },
    });

    return updated;
  });
}


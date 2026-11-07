import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success, created } from '../../common/utils/response.js';
import * as reportsService from './diagnostic-reports.service.js';

function auditCtx(req) {
  return {
    id: req.user.id,
    role: req.user.role,
    doctorId: req.user.doctorId,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? null,
    requestId: req.id ?? null,
  };
}

export const create = asyncHandler(async (req, res) => {
  const report = await reportsService.orderReport(
    req.params.id,
    req.body,
    auditCtx(req),
  );
  return created(res, report);
});

export const listByVisit = asyncHandler(async (req, res) => {
  const reports = await reportsService.getVisitReports(
    req.params.id,
    auditCtx(req),
  );
  return success(res, reports);
});

export const update = asyncHandler(async (req, res) => {
  const report = await reportsService.updateReport(
    req.params.id,
    req.body,
    auditCtx(req),
  );
  return success(res, report);
});


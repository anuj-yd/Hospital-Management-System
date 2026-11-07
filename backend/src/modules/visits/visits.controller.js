import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success, created, paginated } from '../../common/utils/response.js';
import * as visitsService from './visits.service.js';

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

/**
 * POST /visits
 */
export const create = asyncHandler(async (req, res) => {
  const visit = await visitsService.createVisit(req.body, auditCtx(req));
  return created(res, visit);
});

/**
 * GET /visits/:id
 */
export const getById = asyncHandler(async (req, res) => {
  const visit = await visitsService.getVisitById(req.params.id, auditCtx(req));
  return success(res, visit);
});

/**
 * GET /patients/:patientId/visits
 */
export const getPatientVisits = asyncHandler(async (req, res) => {
  const { data, meta } = await visitsService.getPatientVisits(
    req.params.patientId,
    req.query,
    auditCtx(req),
  );
  return paginated(res, data, meta);
});

/**
 * PATCH /visits/:id
 */
export const updateNotes = asyncHandler(async (req, res) => {
  const visit = await visitsService.updateVisitNotes(req.params.id, req.body, auditCtx(req));
  return success(res, visit);
});

/**
 * POST /visits/:id/close
 */
export const close = asyncHandler(async (req, res) => {
  const visit = await visitsService.closeVisit(req.params.id, auditCtx(req));
  return success(res, visit);
});


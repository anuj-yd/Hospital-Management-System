import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success, created, noContent, paginated } from '../../common/utils/response.js';
import * as patientsService from './patients.service.js';

/** Build audit context from the Express request object. */
function auditCtx(req) {
  return {
    userId: req.user.id,
    role: req.user.role,
    doctorId: req.user.doctorId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.id,
  };
}

// ─── POST / ─────────────────────────────────────────────────
export const create = asyncHandler(async (req, res) => {
  const patient = await patientsService.createPatient(req.body, auditCtx(req));
  return created(res, patient);
});

// ─── GET /:id ───────────────────────────────────────────────
export const getById = asyncHandler(async (req, res) => {
  const patient = await patientsService.getPatientById(req.params.id, auditCtx(req));
  return success(res, patient);
});

// ─── GET / ──────────────────────────────────────────────────
export const list = asyncHandler(async (req, res) => {
  const { data, meta } = await patientsService.getPatients(req.query, auditCtx(req));
  return paginated(res, data, meta);
});

// ─── PATCH /:id ─────────────────────────────────────────────
export const update = asyncHandler(async (req, res) => {
  const patient = await patientsService.updatePatient(req.params.id, req.body, auditCtx(req));
  return success(res, patient);
});

// ─── DELETE /:id ────────────────────────────────────────────
export const remove = asyncHandler(async (req, res) => {
  await patientsService.deletePatient(req.params.id, auditCtx(req));
  return noContent(res);
});

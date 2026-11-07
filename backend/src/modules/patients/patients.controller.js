import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success, created, noContent, paginated } from '../../common/utils/response.js';
import * as patientsService from './patients.service.js';

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

// POST /patients (FRONT_DESK, ADMIN)
export const create = asyncHandler(async (req, res) => {
  const patient = await patientsService.createPatient(req.body, auditCtx(req));
  return created(res, patient);
});

// GET /patients/:id (audited read, clinician scoped)
export const getById = asyncHandler(async (req, res) => {
  const patient = await patientsService.getPatientById(req.params.id, auditCtx(req));
  return success(res, patient);
});

// GET /patients (search, filters, sort, pagination)
export const list = asyncHandler(async (req, res) => {
  const { data, meta } = await patientsService.getPatients(req.query, auditCtx(req));
  return paginated(res, data, meta);
});

// PATCH /patients/:id (FRONT_DESK, ADMIN)
export const update = asyncHandler(async (req, res) => {
  const patient = await patientsService.updatePatient(req.params.id, req.body, auditCtx(req));
  return success(res, patient);
});

// DELETE /patients/:id (ADMIN only, soft delete)
export const remove = asyncHandler(async (req, res) => {
  await patientsService.deletePatient(req.params.id, auditCtx(req));
  return noContent(res);
});

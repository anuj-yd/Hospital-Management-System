import * as doctorService from './doctors.service.js';
import { success, created, noContent, paginated } from '../../common/utils/response.js';

/**
 * Extract audit context from the request.
 */
function auditCtx(req) {
  return {
    userId: req.user.id,
    role: req.user.role,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
  };
}

/**
 * POST / — create a doctor profile.
 */
export async function create(req, res) {
  const doctor = await doctorService.createDoctor(req.body, auditCtx(req));
  return created(res, doctor);
}

/**
 * GET /:id — get a doctor by ID.
 */
export async function getById(req, res) {
  const doctor = await doctorService.getDoctorById(req.params.id);
  return success(res, doctor);
}

/**
 * GET / — list doctors (paginated).
 */
export async function list(req, res) {
  const { data, meta } = await doctorService.getDoctors(req.query);
  return paginated(res, data, meta);
}

/**
 * PATCH /:id — update a doctor profile.
 */
export async function update(req, res) {
  const doctor = await doctorService.updateDoctor(req.params.id, req.body, auditCtx(req));
  return success(res, doctor);
}

/**
 * DELETE /:id — soft delete a doctor.
 */
export async function remove(req, res) {
  await doctorService.deleteDoctor(req.params.id, auditCtx(req));
  return noContent(res);
}

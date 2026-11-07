import * as doctorService from './doctors.service.js';
import { success, created, paginated } from '../../common/utils/response.js';

function auditCtx(req) {
  return {
    id: req.user.id,
    role: req.user.role,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? null,
    requestId: req.id ?? null,
  };
}

/**
 * POST /doctors — create a doctor profile (ADMIN).
 */
export async function create(req, res) {
  const doctor = await doctorService.createDoctor(req.body, auditCtx(req));
  return created(res, doctor);
}

/**
 * GET /doctors/:id — get doctor by ID (all authenticated roles).
 */
export async function getById(req, res) {
  const doctor = await doctorService.getDoctorById(req.params.id);
  return success(res, doctor);
}

/**
 * GET /doctors — list doctors with filters and pagination (all authenticated roles).
 */
export async function list(req, res) {
  const { data, meta } = await doctorService.getDoctors(req.query);
  return paginated(res, data, meta);
}

/**
 * PATCH /doctors/:id — update a doctor profile (ADMIN).
 */
export async function update(req, res) {
  const doctor = await doctorService.updateDoctor(req.params.id, req.body, auditCtx(req));
  return success(res, doctor);
}

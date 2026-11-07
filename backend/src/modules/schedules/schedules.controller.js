import * as schedulesService from './schedules.service.js';
import { success } from '../../common/utils/response.js';

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
 * GET /doctors/:id/schedules
 */
export async function getDoctorSchedules(req, res) {
  const schedules = await schedulesService.getDoctorSchedules(req.params.id);
  return success(res, schedules);
}

/**
 * PUT /doctors/:id/schedules
 */
export async function replaceDoctorSchedules(req, res) {
  const schedules = await schedulesService.replaceDoctorSchedules(
    req.params.id,
    req.body,
    auditCtx(req),
  );
  return success(res, schedules);
}


import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success, created, paginated } from '../../common/utils/response.js';
import * as appointmentsService from './appointments.service.js';

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
 * GET /doctors/:id/slots
 */
export const getSlots = asyncHandler(async (req, res) => {
  const doctorId = req.params.id || req.query.doctorId;
  const slots = await appointmentsService.getDoctorSlots(doctorId, req.query);
  return success(res, slots);
});

/**
 * POST /appointments
 */
export const create = asyncHandler(async (req, res) => {
  const appointment = await appointmentsService.createAppointment(req.body, auditCtx(req));
  return created(res, appointment);
});

/**
 * GET /appointments
 */
export const list = asyncHandler(async (req, res) => {
  const { data, meta } = await appointmentsService.getAppointments(req.query, auditCtx(req));
  return paginated(res, data, meta);
});

/**
 * GET /appointments/:id
 */
export const getById = asyncHandler(async (req, res) => {
  const appointment = await appointmentsService.getAppointmentById(req.params.id, auditCtx(req));
  return success(res, appointment);
});

/**
 * PATCH /appointments/:id/reschedule
 */
export const reschedule = asyncHandler(async (req, res) => {
  const appointment = await appointmentsService.rescheduleAppointment(
    req.params.id,
    req.body,
    auditCtx(req),
  );
  return success(res, appointment);
});

/**
 * POST /appointments/:id/cancel
 */
export const cancel = asyncHandler(async (req, res) => {
  const appointment = await appointmentsService.cancelAppointment(
    req.params.id,
    req.body,
    auditCtx(req),
  );
  return success(res, appointment);
});

/**
 * POST /appointments/:id/check-in
 */
export const checkIn = asyncHandler(async (req, res) => {
  const appointment = await appointmentsService.checkInAppointment(
    req.params.id,
    auditCtx(req),
  );
  return success(res, appointment);
});

/**
 * POST /appointments/:id/no-show
 */
export const noShow = asyncHandler(async (req, res) => {
  const appointment = await appointmentsService.noShowAppointment(
    req.params.id,
    auditCtx(req),
  );
  return success(res, appointment);
});


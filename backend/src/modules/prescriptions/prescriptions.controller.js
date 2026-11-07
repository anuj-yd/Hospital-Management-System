import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success, created, noContent } from '../../common/utils/response.js';
import * as prescriptionsService from './prescriptions.service.js';

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
  const prescription = await prescriptionsService.addPrescription(
    req.params.id,
    req.body,
    auditCtx(req),
  );
  return created(res, prescription);
});

export const listByVisit = asyncHandler(async (req, res) => {
  const prescriptions = await prescriptionsService.getVisitPrescriptions(
    req.params.id,
    auditCtx(req),
  );
  return success(res, prescriptions);
});

export const update = asyncHandler(async (req, res) => {
  const prescription = await prescriptionsService.updatePrescription(
    req.params.id,
    req.body,
    auditCtx(req),
  );
  return success(res, prescription);
});

export const remove = asyncHandler(async (req, res) => {
  await prescriptionsService.deletePrescription(req.params.id, auditCtx(req));
  return noContent(res);
});


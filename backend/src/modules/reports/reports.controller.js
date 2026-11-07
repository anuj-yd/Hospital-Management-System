import * as service from './reports.service.js';
import { ok } from '../../common/utils/response.js';

/**
 * GET /reports/dashboard
 */
export async function getDashboard(req, res) {
  const result = await service.getDashboard();
  return ok(res, result);
}

/**
 * GET /reports/appointments-summary
 */
export async function getAppointmentsSummary(req, res) {
  const result = await service.getAppointmentsSummary(req.query);
  return ok(res, result);
}

/**
 * GET /reports/billing-summary
 */
export async function getBillingSummary(req, res) {
  const result = await service.getBillingSummary(req.query);
  return ok(res, result);
}


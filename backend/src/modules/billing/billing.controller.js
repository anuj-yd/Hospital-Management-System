import * as service from './billing.service.js';
import { ok, created, paginated } from '../../common/utils/response.js';

/**
 * POST /invoices
 */
export async function create(req, res) {
  const result = await service.createInvoice(req.body, req.user, req);
  return created(res, result);
}

/**
 * POST /invoices/:id/items
 */
export async function addItem(req, res) {
  const result = await service.addItem(req.params.id, req.body, req.user, req);
  return ok(res, result, 201);
}

/**
 * DELETE /invoices/:id/items/:itemId
 */
export async function removeItem(req, res) {
  const result = await service.removeItem(req.params.id, req.params.itemId, req.user, req);
  return ok(res, result);
}

/**
 * POST /invoices/:id/issue
 */
export async function issue(req, res) {
  const result = await service.issueInvoice(req.params.id, req.user, req);
  return ok(res, result);
}

/**
 * POST /invoices/:id/payments
 */
export async function pay(req, res) {
  const idempotencyKey = req.idempotencyKey || req.headers['idempotency-key'] || null;
  const result = await service.processPayment(req.params.id, req.body, idempotencyKey, req.user, req);

  if (result.isReplay) {
    res.setHeader('X-Idempotent-Replay', 'true');
  }

  return created(res, result);
}

/**
 * POST /invoices/:id/void
 */
export async function voidInvoice(req, res) {
  const result = await service.voidInvoice(req.params.id, req.user, req);
  return ok(res, result);
}

/**
 * GET /invoices/:id
 */
export async function getById(req, res) {
  const result = await service.getInvoiceById(req.params.id, req.user, req);
  return ok(res, result);
}

/**
 * GET /invoices
 */
export async function list(req, res) {
  const result = await service.listInvoices(req.query, req.user, req);
  return paginated(res, result.data, result.meta);
}

/**
 * GET /invoices/:id/payments
 */
export async function listPayments(req, res) {
  const result = await service.getInvoicePayments(req.params.id, req.user, req);
  return ok(res, result);
}


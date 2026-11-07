import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { idempotency } from '../../common/middleware/idempotency.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ROLES } from '../../common/constants/roles.js';
import {
  createInvoiceSchema,
  addInvoiceItemSchema,
  createPaymentSchema,
  listInvoicesSchema,
  invoiceIdParamSchema,
  invoiceItemIdParamSchema,
} from './billing.schema.js';
import * as controller from './billing.controller.js';

const router = Router();

// All billing endpoints require authentication
router.use(authenticate);

// Phase 6 Rule: Only FRONT_DESK and ADMIN can access billing; CLINICIAN gets 403 Forbidden
router.use(authorize(ROLES.ADMIN, ROLES.FRONT_DESK));

// 1. POST /invoices - Create DRAFT invoice
router.post(
  '/',
  validate(createInvoiceSchema),
  asyncHandler(controller.create),
);

// 2. GET /invoices - List invoices with filters and pagination
router.get(
  '/',
  validate(listInvoicesSchema, 'query'),
  asyncHandler(controller.list),
);

// 3. GET /invoices/:id - Get single invoice with items, payments, balanceDue
router.get(
  '/:id',
  validate(invoiceIdParamSchema, 'params'),
  asyncHandler(controller.getById),
);

// 4. POST /invoices/:id/items - Add line item to DRAFT invoice
router.post(
  '/:id/items',
  validate(invoiceIdParamSchema, 'params'),
  validate(addInvoiceItemSchema),
  asyncHandler(controller.addItem),
);

// 5. DELETE /invoices/:id/items/:itemId - Remove line item from DRAFT invoice
router.delete(
  '/:id/items/:itemId',
  validate(invoiceItemIdParamSchema, 'params'),
  asyncHandler(controller.removeItem),
);

// 6. POST /invoices/:id/issue - Issue DRAFT invoice (locks line items and amounts)
router.post(
  '/:id/issue',
  validate(invoiceIdParamSchema, 'params'),
  asyncHandler(controller.issue),
);

// 7. POST /invoices/:id/payments - Record payment (sandbox gateway simulator, idempotency)
router.post(
  '/:id/payments',
  idempotency(),
  validate(invoiceIdParamSchema, 'params'),
  validate(createPaymentSchema),
  asyncHandler(controller.pay),
);

// 8. POST /invoices/:id/void - Void invoice (ADMIN only)
router.post(
  '/:id/void',
  authorize(ROLES.ADMIN),
  validate(invoiceIdParamSchema, 'params'),
  asyncHandler(controller.voidInvoice),
);

// 9. GET /invoices/:id/payments - List payments for invoice
router.get(
  '/:id/payments',
  validate(invoiceIdParamSchema, 'params'),
  asyncHandler(controller.listPayments),
);

export default router;

import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';

const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'];
const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'INSURANCE'];

export const invoiceItemInputSchema = z.object({
  description: z.string().trim().min(1, 'Item description is required').max(255),
  quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1').default(1),
  unitPrice: z.coerce.number().min(0, 'unitPrice must be non-negative'),
});

/**
 * POST /invoices schema
 */
export const createInvoiceSchema = z.object({
  patientId: z.string().uuid('patientId must be a valid UUID'),
  visitId: z.string().uuid('visitId must be a valid UUID').optional().nullable(),
  items: z.array(invoiceItemInputSchema).default([]),
  taxPercent: z.coerce.number().min(0, 'taxPercent must be >= 0').max(100, 'taxPercent cannot exceed 100').default(0),
  discountAmount: z.coerce.number().min(0, 'discountAmount must be >= 0').default(0),
  dueDate: z.string().optional().nullable(),
});

/**
 * POST /invoices/:id/items schema
 */
export const addInvoiceItemSchema = invoiceItemInputSchema;

/**
 * POST /invoices/:id/payments schema
 */
export const createPaymentSchema = z.object({
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  method: z.enum(/** @type {[string, ...string[]]} */ (PAYMENT_METHODS)),
  simulateOutcome: z.enum(['success', 'fail']).default('success').optional(),
});

/**
 * GET /invoices query schema
 */
export const listInvoicesSchema = paginationSchema.merge(
  z.object({
    status: z.enum(/** @type {[string, ...string[]]} */ (INVOICE_STATUSES)).optional(),
    patientId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    search: z.string().trim().optional(),
    q: z.string().trim().optional(),
  }),
);

export const invoiceIdParamSchema = z.object({
  id: z.string().uuid('Invalid invoice ID format'),
});

export const invoiceItemIdParamSchema = z.object({
  id: z.string().uuid('Invalid invoice ID format'),
  itemId: z.string().uuid('Invalid item ID format'),
});

import { describe, it, expect } from '@jest/globals';
import { Prisma } from '@prisma/client';
import {
  computeInvoiceTotals,
  formatInvoice,
  verifyInvoiceInvariants,
} from '../../src/modules/billing/billing.service.js';
import {
  createInvoiceSchema,
  addInvoiceItemSchema,
  createPaymentSchema,
  listInvoicesSchema,
} from '../../src/modules/billing/billing.schema.js';
import { ValidationError } from '../../src/common/errors/index.js';

describe('Phase 6 Billing Unit Tests', () => {
  describe('Totals Calculation & Decimal Math', () => {
    it('computes line totals, subtotal, tax, and total accurately with Decimal precision', () => {
      const items = [
        { description: 'Consultation', quantity: 1, unitPrice: 1500.0 },
        { description: 'Blood Work (CBC)', quantity: 2, unitPrice: 450.5 },
      ];
      // subtotal = 1500 + 901 = 2401.00
      // tax (10%) = 240.10
      // discount = 200.00
      // total = 2401 + 240.10 - 200 = 2441.10
      const totals = computeInvoiceTotals({
        items,
        taxPercent: 10,
        discountAmount: 200,
      });

      expect(totals.subtotal.toString()).toBe('2401');
      expect(totals.taxAmount.toString()).toBe('240.1');
      expect(totals.discountAmount.toString()).toBe('200');
      expect(totals.totalAmount.toString()).toBe('2441.1');
    });

    it('handles decimal tax rates correctly (e.g. 0.10 vs 10)', () => {
      const items = [{ description: 'Cardiology ECG', quantity: 1, unitPrice: 1000.0 }];
      const resFromFraction = computeInvoiceTotals({ items, taxPercent: 0.1, discountAmount: 0 });
      const resFromPercent = computeInvoiceTotals({ items, taxPercent: 10, discountAmount: 0 });

      expect(resFromFraction.taxAmount.toString()).toBe('100');
      expect(resFromPercent.taxAmount.toString()).toBe('100');
      expect(resFromFraction.totalAmount.toString()).toBe('1100');
      expect(resFromPercent.totalAmount.toString()).toBe('1100');
    });

    it('rejects discount that exceeds subtotal plus tax with 422 ValidationError', () => {
      const items = [{ description: 'General Consultation', quantity: 1, unitPrice: 500.0 }];
      // subtotal = 500, tax (10%) = 50 => subtotal + tax = 550. discount = 600
      expect(() => {
        computeInvoiceTotals({
          items,
          taxPercent: 10,
          discountAmount: 600,
        });
      }).toThrow(ValidationError);
    });

    it('computes zero total when discount exactly equals subtotal plus tax', () => {
      const items = [{ description: 'Charity Care Procedure', quantity: 1, unitPrice: 1000.0 }];
      const totals = computeInvoiceTotals({
        items,
        taxPercent: 0,
        discountAmount: 1000,
      });

      expect(totals.totalAmount.toString()).toBe('0');
    });
  });

  describe('Invoice Invariants Enforcement', () => {
    it('passes verification when all financial invariants are strictly satisfied', () => {
      const invoice = {
        subtotal: new Prisma.Decimal('2000.00'),
        taxAmount: new Prisma.Decimal('200.00'),
        discountAmount: new Prisma.Decimal('100.00'),
        totalAmount: new Prisma.Decimal('2100.00'),
        amountPaid: new Prisma.Decimal('1000.00'),
        balanceDue: '1100.00',
        status: 'PARTIALLY_PAID',
        items: [
          { lineTotal: new Prisma.Decimal('1200.00') },
          { lineTotal: new Prisma.Decimal('800.00') },
        ],
        payments: [
          { amount: new Prisma.Decimal('1000.00'), status: 'SUCCEEDED' },
          { amount: new Prisma.Decimal('500.00'), status: 'FAILED' },
        ],
      };

      expect(() => verifyInvoiceInvariants(invoice)).not.toThrow();
    });

    it('throws error when total does not equal subtotal + tax - discount', () => {
      const corruptedInvoice = {
        subtotal: new Prisma.Decimal('1000.00'),
        taxAmount: new Prisma.Decimal('100.00'),
        discountAmount: new Prisma.Decimal('50.00'),
        totalAmount: new Prisma.Decimal('1200.00'), // should be 1050.00
        amountPaid: new Prisma.Decimal('0.00'),
        balanceDue: '1200.00',
        status: 'ISSUED',
        items: [{ lineTotal: new Prisma.Decimal('1000.00') }],
        payments: [],
      };

      expect(() => verifyInvoiceInvariants(corruptedInvoice)).toThrow(/Invariant violation: total/);
    });

    it('throws error when subtotal does not equal sum of item line totals', () => {
      const corruptedInvoice = {
        subtotal: new Prisma.Decimal('1500.00'),
        taxAmount: new Prisma.Decimal('0.00'),
        discountAmount: new Prisma.Decimal('0.00'),
        totalAmount: new Prisma.Decimal('1500.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        balanceDue: '1500.00',
        status: 'ISSUED',
        items: [{ lineTotal: new Prisma.Decimal('1000.00') }], // sum is 1000, subtotal is 1500
        payments: [],
      };

      expect(() => verifyInvoiceInvariants(corruptedInvoice)).toThrow(/sum of item line totals/);
    });

    it('throws error when amountPaid does not match sum of SUCCEEDED payments', () => {
      const corruptedInvoice = {
        subtotal: new Prisma.Decimal('1000.00'),
        taxAmount: new Prisma.Decimal('0.00'),
        discountAmount: new Prisma.Decimal('0.00'),
        totalAmount: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('1000.00'), // claims 1000 paid
        balanceDue: '0.00',
        status: 'PAID',
        items: [{ lineTotal: new Prisma.Decimal('1000.00') }],
        payments: [
          { amount: new Prisma.Decimal('500.00'), status: 'SUCCEEDED' }, // only 500 succeeded
        ],
      };

      expect(() => verifyInvoiceInvariants(corruptedInvoice)).toThrow(/sum of SUCCEEDED payments/);
    });

    it('computes correct balanceDue via formatInvoice', () => {
      const rawInvoice = {
        id: 'inv-123',
        totalAmount: new Prisma.Decimal('1500.00'),
        amountPaid: new Prisma.Decimal('500.00'),
      };
      const formatted = formatInvoice(rawInvoice);
      expect(formatted.balanceDue).toBe('1000.00');
    });
  });

  describe('Zod Validation Schemas', () => {
    it('accepts compliant createInvoice payload', () => {
      const payload = {
        patientId: '10000000-0000-0000-0000-000000000001',
        items: [
          { description: 'Bed Charge (Standard Ward)', quantity: 2, unitPrice: 1200 },
        ],
        taxPercent: 5,
        discountAmount: 100,
      };
      const parsed = createInvoiceSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      expect(parsed.data.items).toHaveLength(1);
    });

    it('rejects createInvoice with negative discount or tax', () => {
      const invalidPayload = {
        patientId: '10000000-0000-0000-0000-000000000001',
        items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        taxPercent: -5,
      };
      const parsed = createInvoiceSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });

    it('validates addInvoiceItem payload and defaults quantity to 1', () => {
      const validItem = {
        description: 'Nebulization Session',
        unitPrice: 250,
      };
      const parsed = addInvoiceItemSchema.safeParse(validItem);
      expect(parsed.success).toBe(true);
      expect(parsed.data.quantity).toBe(1);
    });

    it('rejects addInvoiceItem with non-integer or negative quantity', () => {
      const invalidItem = {
        description: 'Syringe',
        quantity: 0,
        unitPrice: 10,
      };
      const parsed = addInvoiceItemSchema.safeParse(invalidItem);
      expect(parsed.success).toBe(false);
    });

    it('validates payment input schema and allowed methods', () => {
      const validPayment = {
        amount: 500,
        method: 'UPI',
        simulateOutcome: 'success',
      };
      const parsed = createPaymentSchema.safeParse(validPayment);
      expect(parsed.success).toBe(true);

      const invalidMethod = {
        amount: 500,
        method: 'BITCOIN',
      };
      expect(createPaymentSchema.safeParse(invalidMethod).success).toBe(false);
    });

    it('validates invoice query filter schema', () => {
      const validQuery = {
        status: 'ISSUED',
        page: '1',
        limit: '20',
        search: 'INV-2026',
      };
      const parsed = listInvoicesSchema.safeParse(validQuery);
      expect(parsed.success).toBe(true);
      expect(parsed.data.status).toBe('ISSUED');
    });
  });
});


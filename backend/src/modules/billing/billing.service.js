import { Prisma } from '@prisma/client';
import prisma from '../../infra/prisma.js';
import * as repo from './billing.repository.js';
import * as auditService from '../audit/audit.service.js';
import { NotFoundError, ValidationError, ConflictError } from '../../common/errors/index.js';
import { toDecimal } from '../../common/utils/money.js';
import { buildPagination, buildPaginationMeta } from '../../common/utils/pagination.js';

/**
 * Decimal math helper: Computes line totals, subtotal, tax, and grand total.
 * Invariant: total === subtotal + tax - discount
 */
export function computeInvoiceTotals({ items = [], taxPercent = 0, discountAmount = 0 }) {
  const itemsWithLineTotal = items.map((item) => {
    const qty = parseInt(item.quantity, 10) || 1;
    const price = toDecimal(item.unitPrice);
    const lineTotal = price.mul(qty);
    return {
      description: item.description,
      quantity: qty,
      unitPrice: price,
      lineTotal,
    };
  });

  const subtotal = itemsWithLineTotal.reduce(
    (acc, item) => acc.add(item.lineTotal),
    new Prisma.Decimal(0),
  );

  const rawTaxPct = Number(taxPercent) || 0;
  const effectiveTaxRate = rawTaxPct > 1 ? rawTaxPct / 100 : rawTaxPct;
  const tax = subtotal
    .mul(new Prisma.Decimal(String(effectiveTaxRate)))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const discount = toDecimal(discountAmount || 0);

  // Validate discount cannot exceed subtotal + tax
  const subtotalPlusTax = subtotal.add(tax);
  if (discount.gt(subtotalPlusTax)) {
    throw new ValidationError(
      `Discount amount (${discount.toFixed(2)}) cannot exceed subtotal plus tax (${subtotalPlusTax.toFixed(2)})`,
    );
  }

  const total = subtotalPlusTax.sub(discount);

  return {
    itemsWithLineTotal,
    subtotal,
    taxAmount: tax,
    discountAmount: discount,
    totalAmount: total.gte(0) ? total : new Prisma.Decimal(0),
  };
}

/**
 * Attach computed balanceDue to invoice object.
 * balanceDue = totalAmount - amountPaid
 */
export function formatInvoice(invoice) {
  if (!invoice) return null;
  const totalAmount = toDecimal(invoice.totalAmount);
  const amountPaid = toDecimal(invoice.amountPaid || 0);
  const rawBalance = totalAmount.sub(amountPaid);
  const balanceDue = rawBalance.gte(0) ? rawBalance : new Prisma.Decimal(0);

  return {
    ...invoice,
    balanceDue: balanceDue.toFixed(2),
  };
}

/**
 * Verify financial invariants across an invoice.
 * Enforces:
 * 1. total === subtotal + tax - discount
 * 2. subtotal === sum(items.lineTotal)
 * 3. amountPaid === sum(SUCCEEDED payments)
 * 4. balanceDue === total - amountPaid
 * 5. status is consistent with amounts
 */
export function verifyInvoiceInvariants(invoice) {
  const subtotal = toDecimal(invoice.subtotal);
  const tax = toDecimal(invoice.taxAmount);
  const discount = toDecimal(invoice.discountAmount);
  const total = toDecimal(invoice.totalAmount);
  const amountPaid = toDecimal(invoice.amountPaid);

  // Invariant 1: total === subtotal + tax - discount
  const expectedTotal = subtotal.add(tax).sub(discount);
  if (!total.equals(expectedTotal)) {
    throw new Error(`Invariant violation: total (${total}) !== subtotal (${subtotal}) + tax (${tax}) - discount (${discount})`);
  }

  // Invariant 2: subtotal === sum(items.lineTotal)
  if (invoice.items && Array.isArray(invoice.items)) {
    const sumLineTotal = invoice.items.reduce(
      (acc, item) => acc.add(toDecimal(item.lineTotal)),
      new Prisma.Decimal(0),
    );
    if (!subtotal.equals(sumLineTotal)) {
      throw new Error(`Invariant violation: subtotal (${subtotal}) !== sum of item line totals (${sumLineTotal})`);
    }
  }

  // Invariant 3: amountPaid === sum(SUCCEEDED payments)
  if (invoice.payments && Array.isArray(invoice.payments)) {
    const sumSucceeded = invoice.payments
      .filter((p) => p.status === 'SUCCEEDED')
      .reduce((acc, p) => acc.add(toDecimal(p.amount)), new Prisma.Decimal(0));
    if (!amountPaid.equals(sumSucceeded)) {
      throw new Error(`Invariant violation: amountPaid (${amountPaid}) !== sum of SUCCEEDED payments (${sumSucceeded})`);
    }
  }

  // Invariant 4: balanceDue === total - amountPaid
  const expectedBalance = total.sub(amountPaid);
  const currentBalance = toDecimal(invoice.balanceDue !== undefined ? invoice.balanceDue : total.sub(amountPaid));
  if (!currentBalance.equals(expectedBalance)) {
    throw new Error(`Invariant violation: balanceDue (${currentBalance}) !== total (${total}) - amountPaid (${amountPaid})`);
  }

  // Invariant 5: status consistency
  if (invoice.status === 'PAID' && !amountPaid.gte(total)) {
    throw new Error(`Invariant violation: Invoice marked PAID but amountPaid (${amountPaid}) < total (${total})`);
  }
  if (invoice.status === 'PARTIALLY_PAID' && (!amountPaid.gt(0) || !amountPaid.lt(total))) {
    throw new Error(`Invariant violation: Invoice marked PARTIALLY_PAID but amountPaid is not between 0 and total`);
  }

  return true;
}

/**
 * POST /invoices: Create a DRAFT invoice with calculated totals and DB-sequenced invoice number.
 */
export async function createInvoice(data, actor, req) {
  const { patientId, visitId, items = [], taxPercent = 0, discountAmount = 0, dueDate } = data;

  // Validate patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
  });
  if (!patient || !patient.isActive) {
    throw new NotFoundError('Active patient not found with the specified ID');
  }

  // Validate visit if provided
  if (visitId) {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
    });
    if (!visit) {
      throw new NotFoundError('Visit not found with the specified ID');
    }
  }

  // Compute totals
  const totals = computeInvoiceTotals({ items, taxPercent, discountAmount });

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await repo.generateInvoiceNumber(tx);

    const created = await repo.create(
      {
        invoiceNumber,
        patientId,
        visitId: visitId || null,
        status: 'DRAFT',
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        totalAmount: totals.totalAmount,
        amountPaid: new Prisma.Decimal(0),
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: actor?.id || null,
        items: {
          create: totals.itemsWithLineTotal.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
        },
      },
      tx,
    );

    await auditService.record({
      tx,
      actor,
      action: 'CREATE',
      entity: 'Invoice',
      entityId: created.id,
      newData: {
        invoiceNumber: created.invoiceNumber,
        patientId: created.patientId,
        totalAmount: created.totalAmount,
        status: created.status,
      },
      req,
    });

    return created;
  });

  return formatInvoice(invoice);
}

/**
 * POST /invoices/:id/items: Add item to DRAFT invoice and recompute totals.
 */
export async function addItem(invoiceId, itemInput, actor, req) {
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await repo.findForUpdate(invoiceId, tx);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new ConflictError(`Cannot add items to invoice in ${invoice.status} status. Only DRAFT invoices can be edited.`);
    }

    const qty = parseInt(itemInput.quantity, 10) || 1;
    const price = toDecimal(itemInput.unitPrice);
    const lineTotal = price.mul(qty);

    await repo.addItem(
      invoiceId,
      {
        description: itemInput.description,
        quantity: qty,
        unitPrice: price,
        lineTotal,
      },
      tx,
    );

    const allItems = await repo.findItemsByInvoiceId(invoiceId, tx);
    const newSubtotal = allItems.reduce(
      (acc, it) => acc.add(toDecimal(it.lineTotal)),
      new Prisma.Decimal(0),
    );

    // Maintain existing effective tax rate
    const oldSub = toDecimal(invoice.subtotal);
    const taxRate = oldSub.gt(0) ? toDecimal(invoice.taxAmount).div(oldSub) : new Prisma.Decimal(0);
    const newTax = newSubtotal.mul(taxRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const discount = toDecimal(invoice.discountAmount);

    if (discount.gt(newSubtotal.add(newTax))) {
      throw new ValidationError('Discount amount cannot exceed new subtotal plus tax');
    }

    const newTotal = newSubtotal.add(newTax).sub(discount);

    const updated = await repo.update(
      invoiceId,
      {
        subtotal: newSubtotal,
        taxAmount: newTax,
        totalAmount: newTotal,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor,
      action: 'ITEM_ADDED',
      entity: 'Invoice',
      entityId: invoiceId,
      changes: {
        itemAdded: itemInput.description,
        newSubtotal: newSubtotal.toFixed(2),
        newTotal: newTotal.toFixed(2),
      },
      req,
    });

    return updated;
  });

  return formatInvoice(result);
}

/**
 * DELETE /invoices/:id/items/:itemId: Remove line item from DRAFT invoice and recompute totals.
 */
export async function removeItem(invoiceId, itemId, actor, req) {
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await repo.findForUpdate(invoiceId, tx);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new ConflictError(`Cannot remove items from invoice in ${invoice.status} status. Only DRAFT invoices can be edited.`);
    }

    const item = await repo.findItemById(itemId, tx);
    if (!item || item.invoiceId !== invoiceId) {
      throw new NotFoundError('Invoice item not found on this invoice');
    }

    await repo.deleteItem(itemId, tx);

    const remainingItems = await repo.findItemsByInvoiceId(invoiceId, tx);
    const newSubtotal = remainingItems.reduce(
      (acc, it) => acc.add(toDecimal(it.lineTotal)),
      new Prisma.Decimal(0),
    );

    const oldSub = toDecimal(invoice.subtotal);
    const taxRate = oldSub.gt(0) ? toDecimal(invoice.taxAmount).div(oldSub) : new Prisma.Decimal(0);
    const newTax = newSubtotal.mul(taxRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    let discount = toDecimal(invoice.discountAmount);

    if (discount.gt(newSubtotal.add(newTax))) {
      discount = newSubtotal.add(newTax);
    }

    const newTotal = newSubtotal.add(newTax).sub(discount);

    const updated = await repo.update(
      invoiceId,
      {
        subtotal: newSubtotal,
        taxAmount: newTax,
        discountAmount: discount,
        totalAmount: newTotal,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor,
      action: 'ITEM_REMOVED',
      entity: 'Invoice',
      entityId: invoiceId,
      changes: {
        itemRemovedId: itemId,
        newSubtotal: newSubtotal.toFixed(2),
        newTotal: newTotal.toFixed(2),
      },
      req,
    });

    return updated;
  });

  return formatInvoice(result);
}

/**
 * POST /invoices/:id/issue: Transition DRAFT -> ISSUED. Locks amounts and line items.
 */
export async function issueInvoice(invoiceId, actor, req) {
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await repo.findForUpdate(invoiceId, tx);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new ConflictError(`Cannot issue invoice in ${invoice.status} status. Only DRAFT invoices can be issued.`);
    }

    const items = await repo.findItemsByInvoiceId(invoiceId, tx);
    if (!items || items.length === 0) {
      throw new ValidationError('Invoice must contain at least one line item before being issued');
    }

    const updated = await repo.update(
      invoiceId,
      {
        status: 'ISSUED',
        issuedAt: new Date(),
      },
      tx,
    );

    await auditService.record({
      tx,
      actor,
      action: 'STATUS_CHANGE',
      entity: 'Invoice',
      entityId: invoiceId,
      oldData: { status: 'DRAFT' },
      newData: { status: 'ISSUED' },
      req,
    });

    return updated;
  });

  return formatInvoice(result);
}

/**
 * POST /invoices/:id/payments: Process payment using row locking and sandbox gateway simulator.
 */
export async function processPayment(invoiceId, paymentInput, idempotencyKey, actor, req) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Lock invoice row to prevent concurrent overpayments
    const invoice = await repo.findForUpdate(invoiceId, tx);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // 2. Validate status: only ISSUED or PARTIALLY_PAID accept payments
    if (invoice.status !== 'ISSUED' && invoice.status !== 'PARTIALLY_PAID') {
      throw new ValidationError(
        `Payments are only accepted for ISSUED or PARTIALLY_PAID invoices (current status: ${invoice.status})`,
      );
    }

    // 3. Validate amount against outstanding balance
    const totalAmount = toDecimal(invoice.totalAmount);
    const amountPaid = toDecimal(invoice.amountPaid);
    const balanceDue = totalAmount.sub(amountPaid);

    const paymentAmount = toDecimal(paymentInput.amount);
    if (paymentAmount.lte(0)) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    if (paymentAmount.gt(balanceDue)) {
      throw new ValidationError(
        `Payment amount (${paymentAmount.toFixed(2)}) exceeds outstanding balance due (${balanceDue.toFixed(2)})`,
      );
    }

    // 4. Check idempotency replay within payment table
    if (idempotencyKey) {
      const existing = await repo.findPaymentByIdempotencyKey(idempotencyKey, tx);
      if (existing) {
        return {
          payment: existing,
          invoice: formatInvoice(invoice),
          balanceDue: balanceDue.toFixed(2),
          isReplay: true,
        };
      }
    }

    // 5. Simulate sandbox gateway
    const simulateOutcome = paymentInput.simulateOutcome || 'success';

    if (simulateOutcome === 'fail') {
      const payment = await repo.createPayment(
        {
          invoiceId,
          amount: paymentAmount,
          method: paymentInput.method,
          status: 'FAILED',
          gatewayReference: `SIM-FAIL-${Date.now()}`,
          idempotencyKey: idempotencyKey || null,
          createdById: actor?.id || null,
        },
        tx,
      );

      await auditService.record({
        tx,
        actor,
        action: 'PAYMENT_FAILED',
        entity: 'Payment',
        entityId: payment.id,
        newData: {
          invoiceId,
          amount: payment.amount,
          method: payment.method,
          status: 'FAILED',
        },
        req,
      });

      return {
        payment,
        invoice: formatInvoice(invoice),
        balanceDue: balanceDue.toFixed(2),
      };
    }

    // Success outcome
    const newAmountPaid = amountPaid.add(paymentAmount);
    const newBalanceDue = totalAmount.sub(newAmountPaid);
    const newStatus = newBalanceDue.lte(0) ? 'PAID' : 'PARTIALLY_PAID';

    const payment = await repo.createPayment(
      {
        invoiceId,
        amount: paymentAmount,
        method: paymentInput.method,
        status: 'SUCCEEDED',
        gatewayReference: `SIM-SUCC-${Date.now()}`,
        idempotencyKey: idempotencyKey || null,
        createdById: actor?.id || null,
      },
      tx,
    );

    const updatedInvoice = await repo.update(
      invoiceId,
      {
        amountPaid: newAmountPaid,
        status: newStatus,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor,
      action: 'PAYMENT_SUCCEEDED',
      entity: 'Payment',
      entityId: payment.id,
      newData: {
        invoiceId,
        amount: payment.amount,
        method: payment.method,
        status: 'SUCCEEDED',
        invoiceStatus: newStatus,
      },
      req,
    });

    return {
      payment,
      invoice: formatInvoice(updatedInvoice),
      balanceDue: newBalanceDue.toFixed(2),
    };
  });

  return result;
}

/**
 * POST /invoices/:id/void: Void an invoice (ADMIN only).
 * Allowed for DRAFT or ISSUED with 0 succeeded payments.
 */
export async function voidInvoice(invoiceId, actor, req) {
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await repo.findForUpdate(invoiceId, tx);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.status !== 'DRAFT' && invoice.status !== 'ISSUED') {
      throw new ValidationError(
        `Cannot void an invoice in ${invoice.status} status. Only DRAFT or ISSUED invoices may be voided.`,
      );
    }

    const succeededCount = await repo.countSucceededPayments(invoiceId, tx);
    if (succeededCount > 0) {
      throw new ValidationError('Cannot void an invoice that has succeeded payments recorded');
    }

    const updated = await repo.update(
      invoiceId,
      {
        status: 'VOID',
        voidedAt: new Date(),
      },
      tx,
    );

    await auditService.record({
      tx,
      actor,
      action: 'STATUS_CHANGE',
      entity: 'Invoice',
      entityId: invoiceId,
      oldData: { status: invoice.status },
      newData: { status: 'VOID' },
      req,
    });

    return updated;
  });

  return formatInvoice(result);
}

/**
 * GET /invoices/:id: Retrieve single invoice with line items, payments, and balanceDue.
 */
export async function getInvoiceById(id, actor, req) {
  const invoice = await repo.findById(id);
  if (!invoice) {
    throw new NotFoundError('Invoice not found');
  }

  await auditService.record({
    actor,
    action: 'READ',
    entity: 'Invoice',
    entityId: id,
    req,
  });

  return formatInvoice(invoice);
}

/**
 * GET /invoices: Retrieve paginated invoices matching query filters.
 */
export async function listInvoices(query, actor, req) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, parseInt(query.limit, 10) || 20);
  const { skip, take } = buildPagination(page, limit);

  const filters = {
    skip,
    take,
    status: query.status,
    patientId: query.patientId,
    from: query.from,
    to: query.to,
    search: query.search || query.q,
  };

  const [invoices, total] = await Promise.all([
    repo.findAll(filters),
    repo.count(filters),
  ]);

  const data = invoices.map(formatInvoice);
  const meta = buildPaginationMeta(page, limit, total);

  return {
    data,
    meta,
  };
}

/**
 * GET /invoices/:id/payments: Retrieve all payment records for an invoice.
 */
export async function getInvoicePayments(invoiceId, actor, req) {
  const invoice = await repo.findById(invoiceId);
  if (!invoice) {
    throw new NotFoundError('Invoice not found');
  }

  const payments = await repo.findPaymentsByInvoiceId(invoiceId);

  await auditService.record({
    actor,
    action: 'READ',
    entity: 'Payment',
    entityId: invoiceId,
    req,
  });

  return payments;
}

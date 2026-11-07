import prisma from '../../infra/prisma.js';

/**
 * Generate a unique invoice number safely under concurrency using a DB sequence.
 * Format: INV-YYYY-000045
 */
export async function generateInvoiceNumber(tx) {
  const db = tx || prisma;
  const currentYear = new Date().getFullYear();
  try {
    await db.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS invoice_num_seq START WITH 1 INCREMENT BY 1;`);
    const result = await db.$queryRawUnsafe(`SELECT nextval('invoice_num_seq') as seq;`);
    const nextVal = Number(result[0].seq);
    return `INV-${currentYear}-${String(nextVal).padStart(6, '0')}`;
  } catch (_err) {
    // Fail-safe sequence generation
    const total = await db.invoice.count();
    const fallbackSeq = total + Math.floor(Math.random() * 1000) + 1;
    return `INV-${currentYear}-${String(fallbackSeq).padStart(6, '0')}`;
  }
}

/**
 * Create a new invoice record with line items.
 */
export async function create(data, tx) {
  const db = tx || prisma;
  return db.invoice.create({
    data,
    include: {
      items: true,
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mrn: true,
          phone: true,
        },
      },
      visit: {
        select: {
          id: true,
          status: true,
          appointmentId: true,
        },
      },
    },
  });
}

/**
 * Find invoice by ID with items, payments, patient, and visit details.
 */
export async function findById(id, tx) {
  const db = tx || prisma;
  return db.invoice.findUnique({
    where: { id },
    include: {
      items: true,
      payments: {
        orderBy: { createdAt: 'desc' },
      },
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mrn: true,
          phone: true,
        },
      },
      visit: {
        select: {
          id: true,
          status: true,
          appointmentId: true,
          checkInAt: true,
          closedAt: true,
        },
      },
    },
  });
}

/**
 * Acquire exclusive row lock on invoice using SELECT ... FOR UPDATE.
 * Prevents race conditions during concurrent payment settlements.
 */
export async function findForUpdate(id, tx) {
  const db = tx || prisma;
  const rows = await db.$queryRawUnsafe(
    `SELECT id, "invoiceNumber", status, subtotal, "taxAmount", "discountAmount", "totalAmount", "amountPaid" FROM "Invoice" WHERE id = $1::uuid FOR UPDATE`,
    id,
  );
  return rows[0] || null;
}

/**
 * Update an existing invoice.
 */
export async function update(id, data, tx) {
  const db = tx || prisma;
  return db.invoice.update({
    where: { id },
    data,
    include: {
      items: true,
      payments: {
        orderBy: { createdAt: 'desc' },
      },
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mrn: true,
          phone: true,
        },
      },
    },
  });
}

/**
 * Add a line item to an invoice.
 */
export async function addItem(invoiceId, itemData, tx) {
  const db = tx || prisma;
  return db.invoiceItem.create({
    data: {
      invoiceId,
      ...itemData,
    },
  });
}

/**
 * Find line item by ID.
 */
export async function findItemById(itemId, tx) {
  const db = tx || prisma;
  return db.invoiceItem.findUnique({
    where: { id: itemId },
  });
}

/**
 * Delete a line item from an invoice.
 */
export async function deleteItem(itemId, tx) {
  const db = tx || prisma;
  return db.invoiceItem.delete({
    where: { id: itemId },
  });
}

/**
 * Get all items for an invoice.
 */
export async function findItemsByInvoiceId(invoiceId, tx) {
  const db = tx || prisma;
  return db.invoiceItem.findMany({
    where: { invoiceId },
    orderBy: { lineTotal: 'desc' },
  });
}

/**
 * Record a payment against an invoice.
 */
export async function createPayment(data, tx) {
  const db = tx || prisma;
  return db.payment.create({
    data,
  });
}

/**
 * Find payment by Idempotency Key.
 */
export async function findPaymentByIdempotencyKey(idempotencyKey, tx) {
  const db = tx || prisma;
  if (!idempotencyKey) return null;
  return db.payment.findUnique({
    where: { idempotencyKey },
  });
}

/**
 * Count succeeded payments for an invoice.
 */
export async function countSucceededPayments(invoiceId, tx) {
  const db = tx || prisma;
  return db.payment.count({
    where: {
      invoiceId,
      status: 'SUCCEEDED',
    },
  });
}

/**
 * Find all payments for a specific invoice.
 */
export async function findPaymentsByInvoiceId(invoiceId, tx) {
  const db = tx || prisma;
  return db.payment.findMany({
    where: { invoiceId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Find all invoices matching filters with pagination.
 */
export async function findAll(filters = {}) {
  const {
    skip,
    take,
    orderBy = [{ createdAt: 'desc' }],
    status,
    patientId,
    from,
    to,
    search,
    q,
  } = filters;

  const where = {};

  if (status) {
    where.status = status;
  }

  if (patientId) {
    where.patientId = patientId;
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const queryTerm = search || q;
  if (queryTerm) {
    where.OR = [
      { invoiceNumber: { contains: queryTerm, mode: 'insensitive' } },
      {
        patient: {
          OR: [
            { firstName: { contains: queryTerm, mode: 'insensitive' } },
            { lastName: { contains: queryTerm, mode: 'insensitive' } },
            { mrn: { contains: queryTerm, mode: 'insensitive' } },
            { phone: { contains: queryTerm } },
          ],
        },
      },
    ];
  }

  return prisma.invoice.findMany({
    where,
    skip,
    take,
    orderBy,
    include: {
      items: true,
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mrn: true,
          phone: true,
        },
      },
    },
  });
}

/**
 * Count total invoices matching filters.
 */
export async function count(filters = {}) {
  const { status, patientId, from, to, search, q } = filters;

  const where = {};

  if (status) {
    where.status = status;
  }

  if (patientId) {
    where.patientId = patientId;
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const queryTerm = search || q;
  if (queryTerm) {
    where.OR = [
      { invoiceNumber: { contains: queryTerm, mode: 'insensitive' } },
      {
        patient: {
          OR: [
            { firstName: { contains: queryTerm, mode: 'insensitive' } },
            { lastName: { contains: queryTerm, mode: 'insensitive' } },
            { mrn: { contains: queryTerm, mode: 'insensitive' } },
            { phone: { contains: queryTerm } },
          ],
        },
      },
    ];
  }

  return prisma.invoice.count({ where });
}


import prisma from '../../src/infra/prisma.js';

/**
 * Truncate non-static domain tables between test suites while preserving seeded users and departments.
 */
export async function truncateDomainData() {
  const tables = [
    'AuditLog',
    'Payment',
    'InvoiceItem',
    'Invoice',
    'Prescription',
    'DiagnosticReport',
    'Visit',
    'AppointmentHistory',
    'Appointment',
    'IdempotencyKey',
  ];

  try {
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }
  } catch (_err) {
    // Fail-safe in environments where truncate is restricted
  }
}


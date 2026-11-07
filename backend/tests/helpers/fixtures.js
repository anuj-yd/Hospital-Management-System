import prisma from '../../src/infra/prisma.js';

/**
 * Test fixture generators for creating clean database state in integration testing.
 */

export async function createTestPatient(overrides = {}) {
  const timestamp = Date.now().toString().slice(-6);
  return prisma.patient.create({
    data: {
      mrn: overrides.mrn || `HMS-TEST-${timestamp}`,
      firstName: overrides.firstName || 'Test',
      lastName: overrides.lastName || 'Patient',
      gender: overrides.gender || 'MALE',
      dateOfBirth: overrides.dateOfBirth || new Date('1990-01-01'),
      phone: overrides.phone || `+9198${timestamp}01`,
      email: overrides.email || `patient-${timestamp}@test.local`,
      isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    },
  });
}

export async function createTestAppointment(patientId, doctorId, startTime, overrides = {}) {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  return prisma.appointment.create({
    data: {
      patientId,
      doctorId,
      startTime: start,
      endTime: end,
      status: overrides.status || 'SCHEDULED',
      reason: overrides.reason || 'General Health Consultation',
      rescheduleCount: overrides.rescheduleCount || 0,
      createdById: overrides.createdById || null,
    },
  });
}

export async function createTestInvoice(patientId, overrides = {}) {
  const timestamp = Date.now().toString().slice(-6);
  return prisma.invoice.create({
    data: {
      invoiceNumber: overrides.invoiceNumber || `INV-TEST-${timestamp}`,
      patientId,
      status: overrides.status || 'DRAFT',
      subtotal: overrides.subtotal || 1000.0,
      taxAmount: overrides.taxAmount || 100.0,
      discountAmount: overrides.discountAmount || 0.0,
      totalAmount: overrides.totalAmount || 1100.0,
      amountPaid: overrides.amountPaid || 0.0,
      items: {
        create: overrides.items || [
          {
            description: 'Routine Health Checkup',
            quantity: 1,
            unitPrice: 1000.0,
            lineTotal: 1000.0,
          },
        ],
      },
    },
    include: {
      items: true,
      payments: true,
    },
  });
}


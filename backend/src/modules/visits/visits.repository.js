import prisma from '../../infra/prisma.js';

const FULL_INCLUDE = {
  patient: {
    select: {
      id: true,
      mrn: true,
      firstName: true,
      lastName: true,
      phone: true,
      gender: true,
      dateOfBirth: true,
    },
  },
  doctor: {
    select: {
      id: true,
      specialization: true,
      licenseNumber: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  appointment: {
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
      reason: true,
    },
  },
  prescriptions: {
    orderBy: { createdAt: 'asc' },
  },
  diagnosticReports: {
    orderBy: { createdAt: 'asc' },
  },
};

/**
 * Create a new clinical visit.
 */
export async function create(data, tx) {
  const db = tx || prisma;
  return db.visit.create({
    data,
    include: FULL_INCLUDE,
  });
}

/**
 * Find visit by ID.
 */
export async function findById(id, tx) {
  const db = tx || prisma;
  return db.visit.findUnique({
    where: { id },
    include: FULL_INCLUDE,
  });
}

/**
 * Find visit by appointment ID.
 */
export async function findByAppointmentId(appointmentId, tx) {
  const db = tx || prisma;
  return db.visit.findUnique({
    where: { appointmentId },
  });
}

/**
 * Find paginated visits for a patient.
 */
export async function findAllByPatientId(filters, tx) {
  const db = tx || prisma;
  const { patientId, doctorId, status, skip, take } = filters;

  const where = { patientId };
  if (doctorId) where.doctorId = doctorId;
  if (status) where.status = status;

  return db.visit.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: FULL_INCLUDE,
  });
}

/**
 * Count visits for a patient matching filters.
 */
export async function countByPatientId(filters, tx) {
  const db = tx || prisma;
  const { patientId, doctorId, status } = filters;

  const where = { patientId };
  if (doctorId) where.doctorId = doctorId;
  if (status) where.status = status;

  return db.visit.count({ where });
}

/**
 * Update visit.
 */
export async function update(id, data, tx) {
  const db = tx || prisma;
  return db.visit.update({
    where: { id },
    data,
    include: FULL_INCLUDE,
  });
}


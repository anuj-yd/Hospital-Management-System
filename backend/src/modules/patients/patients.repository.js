import prisma from '../../infra/prisma.js';

/**
 * Generate a unique Medical Record Number inside a transaction.
 * Format: MRN-000001
 */
export async function generateMrn(tx) {
  const db = tx || prisma;

  // Find the patient with the highest MRN number
  const last = await db.patient.findFirst({
    orderBy: { mrn: 'desc' },
    select: { mrn: true },
  });

  let nextNumber = 1;
  if (last?.mrn) {
    const numPart = parseInt(last.mrn.replace('MRN-', ''), 10);
    if (!isNaN(numPart)) nextNumber = numPart + 1;
  }

  return `MRN-${String(nextNumber).padStart(6, '0')}`;
}

/**
 * Create a patient record.
 */
export async function create(data, tx) {
  const db = tx || prisma;
  return db.patient.create({ data });
}

/**
 * Find patient by ID (excludes soft-deleted by default).
 */
export async function findById(id, { includeSoftDeleted = false } = {}) {
  const where = { id };
  if (!includeSoftDeleted) {
    where.isActive = true;
    where.deletedAt = null;
  }
  return prisma.patient.findFirst({ where });
}

/**
 * Find all patients with pagination, search, and filters.
 * @param {object} filters - { page, limit, orderBy, search, isActive, gender, patientIds }
 */
export async function findAll(filters) {
  const {
    page = 1,
    limit = 20,
    orderBy = [{ createdAt: 'desc' }],
    search,
    isActive,
    gender,
    patientIds, // optional array — used by clinician scoping
  } = filters;

  const where = {};

  // Exclude soft-deleted by default unless isActive explicitly false
  if (isActive === false) {
    where.isActive = false;
  } else if (isActive === true) {
    where.isActive = true;
    where.deletedAt = null;
  } else {
    // Default: only active, non-deleted
    where.isActive = true;
    where.deletedAt = null;
  }

  if (gender) where.gender = gender;

  // Clinician scoping
  if (patientIds) {
    where.id = { in: patientIds };
  }

  // Search across firstName, lastName, mrn, phone
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { mrn: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.patient.count({ where }),
  ]);

  return { data, total };
}

/**
 * Count patients matching filters (delegates to findAll logic).
 */
export async function count(filters) {
  const { search, isActive, gender, patientIds } = filters;

  const where = {};

  if (isActive === false) {
    where.isActive = false;
  } else {
    where.isActive = true;
    where.deletedAt = null;
  }

  if (gender) where.gender = gender;
  if (patientIds) where.id = { in: patientIds };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { mrn: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  return prisma.patient.count({ where });
}

/**
 * Update patient by ID.
 */
export async function update(id, data, tx) {
  const db = tx || prisma;
  return db.patient.update({ where: { id }, data });
}

/**
 * Find distinct patient IDs accessible to a clinician (via appointments or visits).
 */
export async function findPatientIdsForDoctor(doctorId) {
  const [apptPatients, visitPatients] = await Promise.all([
    prisma.appointment.findMany({
      where: { doctorId },
      select: { patientId: true },
      distinct: ['patientId'],
    }),
    prisma.visit.findMany({
      where: { doctorId },
      select: { patientId: true },
      distinct: ['patientId'],
    }),
  ]);

  const ids = new Set([
    ...apptPatients.map((a) => a.patientId),
    ...visitPatients.map((v) => v.patientId),
  ]);

  return [...ids];
}

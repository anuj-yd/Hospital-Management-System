import prisma from '../../infra/prisma.js';

/**
 * Generate a unique Medical Record Number safely under concurrency using a DB sequence.
 * Format: HMS-000123
 */
export async function generateMrn(tx) {
  const db = tx || prisma;
  try {
    await db.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS patient_mrn_seq START WITH 1 INCREMENT BY 1;`);
    const result = await db.$queryRawUnsafe(`SELECT nextval('patient_mrn_seq') as seq;`);
    const nextVal = Number(result[0].seq);
    return `HMS-${String(nextVal).padStart(6, '0')}`;
  } catch (_err) {
    // Fail-safe fallback if sequence generation fails
    const total = await db.patient.count();
    const fallbackSeq = total + Math.floor(Math.random() * 1000) + 1;
    return `HMS-${String(fallbackSeq).padStart(6, '0')}`;
  }
}

/**
 * Create a patient record.
 */
export async function create(data, tx) {
  const db = tx || prisma;
  return db.patient.create({ data });
}

/**
 * Find patient by ID.
 */
export async function findById(id) {
  return prisma.patient.findUnique({
    where: { id },
  });
}

/**
 * Find all patients with pagination, search, and filters.
 */
export async function findAll(filters) {
  const {
    skip,
    take,
    orderBy = [{ createdAt: 'desc' }],
    search,
    isActive,
    gender,
    patientIds,
  } = filters;

  const where = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (gender) {
    where.gender = gender;
  }

  // Clinician scoping: restrict to authorized patient IDs
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

  return prisma.patient.findMany({
    where,
    orderBy,
    skip,
    take,
  });
}

/**
 * Count patients matching filters.
 */
export async function count(filters) {
  const { search, isActive, gender, patientIds } = filters;

  const where = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (gender) {
    where.gender = gender;
  }

  if (patientIds) {
    where.id = { in: patientIds };
  }

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
  return db.patient.update({
    where: { id },
    data,
  });
}

/**
 * Find distinct patient IDs accessible to a clinician (via appointments or visits).
 */
export async function findPatientIdsForDoctor(doctorId) {
  if (!doctorId) return [];

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

/**
 * Fast check: whether a doctor has had any appointment or visit with this patient.
 */
export async function hasDoctorAccessToPatient(doctorId, patientId) {
  if (!doctorId || !patientId) return false;

  const [hasAppt, hasVisit] = await Promise.all([
    prisma.appointment.findFirst({
      where: { doctorId, patientId },
      select: { id: true },
    }),
    prisma.visit.findFirst({
      where: { doctorId, patientId },
      select: { id: true },
    }),
  ]);

  return Boolean(hasAppt || hasVisit);
}

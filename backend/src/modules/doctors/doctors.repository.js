import prisma from '../../infra/prisma.js';

/** Select clause for user relation (never expose passwordHash). */
const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
};

/** Select clause for department relation. */
const departmentSelect = {
  id: true,
  name: true,
};

/**
 * Create a doctor profile.
 */
export async function create(data, tx) {
  const db = tx || prisma;
  return db.doctor.create({
    data,
    include: {
      user: { select: userSelect },
      department: { select: departmentSelect },
    },
  });
}

/**
 * Find a doctor by ID, including user and department.
 */
export async function findById(id) {
  return prisma.doctor.findUnique({
    where: { id },
    include: {
      user: { select: userSelect },
      department: { select: departmentSelect },
    },
  });
}

/**
 * Find a doctor by userId.
 */
export async function findByUserId(userId) {
  return prisma.doctor.findUnique({
    where: { userId },
    include: {
      user: { select: userSelect },
      department: { select: departmentSelect },
    },
  });
}

/**
 * Find a doctor by license number (for uniqueness checks).
 */
export async function findByLicenseNumber(licenseNumber) {
  return prisma.doctor.findFirst({
    where: { licenseNumber },
  });
}

/**
 * Find all doctors with pagination, search, and filters.
 */
export async function findAll(filters) {
  const { skip, take, orderBy, where } = filters;

  return prisma.doctor.findMany({
    where,
    orderBy,
    skip,
    take,
    include: {
      user: { select: userSelect },
      department: { select: departmentSelect },
    },
  });
}

/**
 * Count doctors matching the given where clause.
 */
export async function count(filters) {
  return prisma.doctor.count({ where: filters.where });
}

/**
 * Update a doctor by ID.
 */
export async function update(id, data, tx) {
  const db = tx || prisma;
  return db.doctor.update({
    where: { id },
    data,
    include: {
      user: { select: userSelect },
      department: { select: departmentSelect },
    },
  });
}

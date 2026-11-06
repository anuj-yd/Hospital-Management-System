import prisma from '../../infra/prisma.js';

/** Fields to select when returning a user (exclude passwordHash). */
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Create a new user.
 */
export async function create(data, tx) {
  const db = tx || prisma;
  return db.user.create({
    data: {
      email: data.email,
      passwordHash: data.passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
    },
    select: USER_SELECT,
  });
}

/**
 * Find a user by ID (without passwordHash).
 */
export async function findById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  });
}

/**
 * Find a user by ID including passwordHash (for password verification).
 */
export async function findByIdWithPassword(id) {
  return prisma.user.findUnique({
    where: { id },
  });
}

/**
 * Find all users with pagination, search, and role filter.
 * @returns {Promise<object[]>}
 */
export async function findAll(filters) {
  const {
    skip,
    take,
    orderBy = [{ createdAt: 'desc' }],
    search,
    role,
    isActive,
  } = filters;

  const where = {};

  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive;

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  return prisma.user.findMany({
    where,
    orderBy,
    skip,
    take,
    select: USER_SELECT,
  });
}

/**
 * Count users matching filters.
 */
export async function count(filters) {
  const { search, role, isActive } = filters;

  const where = {};
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive;

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  return prisma.user.count({ where });
}

/**
 * Update a user by ID.
 */
export async function update(id, data, tx) {
  const db = tx || prisma;
  return db.user.update({
    where: { id },
    data,
    select: USER_SELECT,
  });
}


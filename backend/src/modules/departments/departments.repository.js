import prisma from '../../infra/prisma.js';

/**
 * Create a new department.
 */
export async function create(data, tx) {
  const db = tx || prisma;
  return db.department.create({ data });
}

/**
 * Find a department by ID.
 */
export async function findById(id) {
  return prisma.department.findUnique({ where: { id } });
}

/**
 * Find a department by name (for uniqueness checks).
 */
export async function findByName(name) {
  return prisma.department.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
}

/**
 * Find all departments with pagination, search and isActive filter.
 */
export async function findAll(filters) {
  const { skip, take, orderBy, where } = filters;

  return prisma.department.findMany({
    where,
    orderBy,
    skip,
    take,
  });
}

/**
 * Count departments matching the given where clause.
 */
export async function count(filters) {
  return prisma.department.count({ where: filters.where });
}

/**
 * Update a department by ID.
 */
export async function update(id, data, tx) {
  const db = tx || prisma;
  return db.department.update({ where: { id }, data });
}

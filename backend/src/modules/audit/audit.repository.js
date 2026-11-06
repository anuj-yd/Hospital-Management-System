import prisma from '../../infra/prisma.js';

/**
 * Persist an audit log entry.
 * Supports passing transaction client `tx` for atomic writes.
 */
export async function create(data, tx) {
  const db = tx || prisma;

  return db.auditLog.create({
    data: {
      userId: data.userId ?? null,
      userRole: data.userRole ?? null,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId ? String(data.entityId) : null,
      changes: data.changes ?? undefined,
      ip: data.ip ?? null,
      userAgent: data.userAgent ?? null,
      requestId: data.requestId ?? null,
    },
  });
}

// Backward-compatible alias
export const createAuditLog = create;

/**
 * Find audit logs with pagination and multi-criteria filtering.
 */
export async function findAll(filters = {}) {
  const {
    page = 1,
    limit = 20,
    userId,
    action,
    entity,
    entityId,
    dateFrom,
    dateTo,
    orderBy = [{ createdAt: 'desc' }],
  } = filters;

  const where = {};

  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (entity) where.entity = entity;
  if (entityId) where.entityId = String(entityId);

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data, total };
}

/**
 * Retrieve single audit entry by primary key.
 */
export async function findById(id) {
  return prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
        },
      },
    },
  });
}

import prisma from '../../infra/prisma.js';

/**
 * Create an audit log entry. Accepts optional `tx` for transactional writes.
 */
export async function createAuditLog(data, tx) {
  const db = tx || prisma;
  return db.auditLog.create({
    data: {
      userId: data.userId ?? null,
      role: data.role ?? null,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId ?? null,
      changedFields: data.changedFields ?? undefined,
      ip: data.ip ?? null,
      userAgent: data.userAgent ?? null,
      requestId: data.requestId ?? null,
    },
  });
}

/**
 * Find all audit logs with pagination and filters.
 * @param {object} filters - { page, limit, userId, action, entity, entityId, dateFrom, dateTo, orderBy }
 * @returns {{ data: object[], total: number }}
 */
export async function findAll(filters) {
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
  if (entityId) where.entityId = entityId;

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
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data, total };
}


import prisma from '../../infra/prisma.js';
import * as departmentRepo from './departments.repository.js';
import * as auditRepo from '../audit/audit.repository.js';
import { NotFoundError, ConflictError } from '../../common/errors/index.js';
import { buildPagination, buildPaginationMeta, parseSortParam } from '../../common/utils/pagination.js';

const ALLOWED_SORT_FIELDS = ['name', 'createdAt', 'updatedAt'];

/**
 * Create a new department.
 */
export async function createDepartment(data, auditContext) {
  // Check name uniqueness
  const existing = await departmentRepo.findByName(data.name);
  if (existing) {
    throw new ConflictError(`Department with name "${data.name}" already exists`);
  }

  const department = await prisma.$transaction(async (tx) => {
    const created = await departmentRepo.create(data, tx);

    await auditRepo.createAuditLog(
      {
        userId: auditContext.userId,
        role: auditContext.role,
        action: 'CREATE',
        entity: 'Department',
        entityId: created.id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        requestId: auditContext.requestId,
      },
      tx,
    );

    return created;
  });

  return department;
}

/**
 * Get a department by ID.
 */
export async function getDepartmentById(id) {
  const department = await departmentRepo.findById(id);
  if (!department) {
    throw new NotFoundError('Department not found');
  }
  return department;
}

/**
 * Get paginated list of departments.
 */
export async function getDepartments(filters) {
  const { page, limit, sort, search, isActive } = filters;
  const orderBy = parseSortParam(sort, ALLOWED_SORT_FIELDS);
  const { skip, take } = buildPagination(page, limit);

  const where = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const [data, total] = await Promise.all([
    departmentRepo.findAll({ skip, take, orderBy, where }),
    departmentRepo.count({ where }),
  ]);

  const meta = buildPaginationMeta(page, limit, total);
  return { data, meta };
}

/**
 * Update a department.
 */
export async function updateDepartment(id, data, auditContext) {
  const existing = await departmentRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Department not found');
  }

  // Check name uniqueness if name is being changed
  if (data.name && data.name !== existing.name) {
    const duplicate = await departmentRepo.findByName(data.name);
    if (duplicate) {
      throw new ConflictError(`Department with name "${data.name}" already exists`);
    }
  }

  // Build changedFields for audit
  const changedFields = {};
  for (const key of Object.keys(data)) {
    if (data[key] !== existing[key]) {
      changedFields[key] = { old: existing[key], new: data[key] };
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await departmentRepo.update(id, data, tx);

    await auditRepo.createAuditLog(
      {
        userId: auditContext.userId,
        role: auditContext.role,
        action: 'UPDATE',
        entity: 'Department',
        entityId: id,
        changedFields: Object.keys(changedFields).length > 0 ? changedFields : undefined,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        requestId: auditContext.requestId,
      },
      tx,
    );

    return result;
  });

  return updated;
}

/**
 * Soft delete a department (set isActive = false).
 */
export async function deleteDepartment(id, auditContext) {
  const existing = await departmentRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Department not found');
  }

  await prisma.$transaction(async (tx) => {
    await departmentRepo.update(id, { isActive: false }, tx);

    await auditRepo.createAuditLog(
      {
        userId: auditContext.userId,
        role: auditContext.role,
        action: 'DELETE',
        entity: 'Department',
        entityId: id,
        changedFields: { isActive: { old: existing.isActive, new: false } },
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        requestId: auditContext.requestId,
      },
      tx,
    );
  });
}

import prisma from '../../infra/prisma.js';
import * as departmentRepo from './departments.repository.js';
import * as auditService from '../audit/audit.service.js';
import { NotFoundError, ConflictError, BusinessRuleError } from '../../common/errors/index.js';
import { buildPagination, buildPaginationMeta, parseSortParam } from '../../common/utils/pagination.js';

const ALLOWED_SORT_FIELDS = ['name', 'createdAt', 'updatedAt'];

/**
 * Create a new department (ADMIN only).
 */
export async function createDepartment(data, auditContext) {
  const trimmedName = data.name.trim();

  // Check name uniqueness
  const existing = await departmentRepo.findByName(trimmedName);
  if (existing) {
    throw new ConflictError(`Department with name "${trimmedName}" already exists`);
  }

  return prisma.$transaction(async (tx) => {
    const created = await departmentRepo.create(
      {
        name: trimmedName,
        description: data.description ? data.description.trim() : null,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'CREATE',
      entity: 'Department',
      entityId: created.id,
      changes: {
        name: { old: null, new: created.name },
        description: { old: null, new: created.description },
      },
    });

    return created;
  });
}

/**
 * Get a department by ID (all authenticated roles).
 */
export async function getDepartmentById(id) {
  const department = await departmentRepo.findById(id);
  if (!department) {
    throw new NotFoundError('Department', id);
  }
  return department;
}

/**
 * Get paginated list of departments (all authenticated roles).
 */
export async function getDepartments(filters) {
  const { page, limit, sort, search, q, isActive } = filters;
  const searchTerm = (search || q || '').trim();
  const orderBy = parseSortParam(sort, ALLOWED_SORT_FIELDS);
  const { skip, take } = buildPagination(page, limit);

  const where = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (searchTerm) {
    where.name = { contains: searchTerm, mode: 'insensitive' };
  }

  const [data, total] = await Promise.all([
    departmentRepo.findAll({ skip, take, orderBy, where }),
    departmentRepo.count({ where }),
  ]);

  const meta = buildPaginationMeta(page, limit, total);
  return { data, meta };
}

/**
 * Update a department (ADMIN only).
 * Cannot deactivate a department that has active doctors (422).
 */
export async function updateDepartment(id, data, auditContext) {
  const existing = await departmentRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Department', id);
  }

  // Business rule: Cannot deactivate a department that has active doctors (422)
  if (data.isActive === false && existing.isActive === true) {
    const activeDoctorsCount = await departmentRepo.countActiveDoctors(id);
    if (activeDoctorsCount > 0) {
      throw new BusinessRuleError(
        'Cannot deactivate a department that has active doctors',
        [{ field: 'isActive', message: `Department currently has ${activeDoctorsCount} active doctor(s)` }],
      );
    }
  }

  // Check name uniqueness if name is being changed
  const updateData = {};
  if (data.name !== undefined) {
    const trimmedName = data.name.trim();
    if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await departmentRepo.findByName(trimmedName);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(`Department with name "${trimmedName}" already exists`);
      }
    }
    updateData.name = trimmedName;
  }

  if (data.description !== undefined) {
    updateData.description = data.description ? data.description.trim() : null;
  }

  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  // Build changes diff
  const changedFields = {};
  for (const key of Object.keys(updateData)) {
    if (updateData[key] !== existing[key]) {
      changedFields[key] = { old: existing[key], new: updateData[key] };
    }
  }

  if (Object.keys(changedFields).length === 0) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await departmentRepo.update(id, updateData, tx);

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'UPDATE',
      entity: 'Department',
      entityId: id,
      changes: changedFields,
    });

    return updated;
  });
}

import prisma from '../../infra/prisma.js';
import * as doctorRepo from './doctors.repository.js';
import * as auditRepo from '../audit/audit.repository.js';
import * as usersService from '../users/users.service.js';
import * as departmentsService from '../departments/departments.service.js';
import { NotFoundError, ConflictError, BusinessRuleViolationError } from '../../common/errors/index.js';
import { ROLES } from '../../common/constants/roles.js';
import { buildPagination, buildPaginationMeta, parseSortParam } from '../../common/utils/pagination.js';

const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'specialization', 'consultationFee'];

/**
 * Create a new doctor profile.
 */
export async function createDoctor(data, auditContext) {
  // Verify user exists and has CLINICIAN role
  const user = await usersService.getUserById(data.userId);
  if (user.role !== ROLES.CLINICIAN) {
    throw new BusinessRuleViolationError(
      `User must have the ${ROLES.CLINICIAN} role to be registered as a doctor`,
    );
  }

  // Verify department exists
  await departmentsService.getDepartmentById(data.departmentId);

  // Check license number uniqueness
  const existingLicense = await doctorRepo.findByLicenseNumber(data.licenseNumber);
  if (existingLicense) {
    throw new ConflictError(`A doctor with license number "${data.licenseNumber}" already exists`);
  }

  // Check user doesn't already have a doctor profile
  const existingProfile = await doctorRepo.findByUserId(data.userId);
  if (existingProfile) {
    throw new ConflictError('This user already has a doctor profile');
  }

  const doctor = await prisma.$transaction(async (tx) => {
    const created = await doctorRepo.create(data, tx);

    await auditRepo.createAuditLog(
      {
        userId: auditContext.userId,
        role: auditContext.role,
        action: 'CREATE',
        entity: 'Doctor',
        entityId: created.id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        requestId: auditContext.requestId,
      },
      tx,
    );

    return created;
  });

  return doctor;
}

/**
 * Get a doctor by ID (includes user and department info).
 */
export async function getDoctorById(id) {
  const doctor = await doctorRepo.findById(id);
  if (!doctor) {
    throw new NotFoundError('Doctor not found');
  }
  return doctor;
}

/**
 * Get paginated list of doctors.
 */
export async function getDoctors(filters) {
  const { page, limit, sort, search, departmentId, isActive } = filters;
  const orderBy = parseSortParam(sort, ALLOWED_SORT_FIELDS);
  const { skip, take } = buildPagination(page, limit);

  const where = {};

  if (departmentId) {
    where.departmentId = departmentId;
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  // Search on user firstName/lastName or specialization
  if (search) {
    where.OR = [
      { user: { firstName: { contains: search, mode: 'insensitive' } } },
      { user: { lastName: { contains: search, mode: 'insensitive' } } },
      { specialization: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    doctorRepo.findAll({ skip, take, orderBy, where }),
    doctorRepo.count({ where }),
  ]);

  const meta = buildPaginationMeta(page, limit, total);
  return { data, meta };
}

/**
 * Update a doctor profile.
 */
export async function updateDoctor(id, data, auditContext) {
  const existing = await doctorRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Doctor not found');
  }

  // Validate department if changed
  if (data.departmentId && data.departmentId !== existing.departmentId) {
    await departmentsService.getDepartmentById(data.departmentId);
  }

  // Check license number uniqueness if changed
  if (data.licenseNumber && data.licenseNumber !== existing.licenseNumber) {
    const duplicate = await doctorRepo.findByLicenseNumber(data.licenseNumber);
    if (duplicate) {
      throw new ConflictError(`A doctor with license number "${data.licenseNumber}" already exists`);
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
    const result = await doctorRepo.update(id, data, tx);

    await auditRepo.createAuditLog(
      {
        userId: auditContext.userId,
        role: auditContext.role,
        action: 'UPDATE',
        entity: 'Doctor',
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
 * Soft delete a doctor (set isActive = false).
 */
export async function deleteDoctor(id, auditContext) {
  const existing = await doctorRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Doctor not found');
  }

  await prisma.$transaction(async (tx) => {
    await doctorRepo.update(id, { isActive: false }, tx);

    await auditRepo.createAuditLog(
      {
        userId: auditContext.userId,
        role: auditContext.role,
        action: 'DELETE',
        entity: 'Doctor',
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

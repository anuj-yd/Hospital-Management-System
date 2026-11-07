import prisma from '../../infra/prisma.js';
import * as doctorRepo from './doctors.repository.js';
import * as auditService from '../audit/audit.service.js';
import * as usersService from '../users/users.service.js';
import * as departmentsService from '../departments/departments.service.js';
import { NotFoundError, ConflictError, BusinessRuleError } from '../../common/errors/index.js';
import { ROLES } from '../../common/constants/roles.js';
import { buildPagination, buildPaginationMeta, parseSortParam } from '../../common/utils/pagination.js';

const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'specialization', 'consultationFee'];

/**
 * Create a new doctor profile (ADMIN only).
 */
export async function createDoctor(data, auditContext) {
  // 1. If userId is provided, validate user exists, is CLINICIAN, and is not already linked
  if (data.userId) {
    const user = await usersService.getUserById(data.userId);
    if (user.role !== ROLES.CLINICIAN) {
      throw new BusinessRuleError(
        `User must have the ${ROLES.CLINICIAN} role to be registered as a doctor`,
        [{ field: 'userId', message: `User has role '${user.role}' instead of '${ROLES.CLINICIAN}'` }],
      );
    }

    const existingProfile = await doctorRepo.findByUserId(data.userId);
    if (existingProfile) {
      throw new ConflictError('This user already has a doctor profile');
    }
  }

  // 2. Verify department exists
  await departmentsService.getDepartmentById(data.departmentId);

  // 3. Check license number uniqueness
  const trimmedLicense = data.licenseNumber.trim();
  const existingLicense = await doctorRepo.findByLicenseNumber(trimmedLicense);
  if (existingLicense) {
    throw new ConflictError(`A doctor with license number "${trimmedLicense}" already exists`);
  }

  return prisma.$transaction(async (tx) => {
    const created = await doctorRepo.create(
      {
        userId: data.userId || null,
        departmentId: data.departmentId,
        specialization: data.specialization.trim(),
        licenseNumber: trimmedLicense,
        slotDurationMin: data.slotDurationMin ?? 30,
        consultationFee: data.consultationFee,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'CREATE',
      entity: 'Doctor',
      entityId: created.id,
      changes: {
        userId: { old: null, new: created.userId },
        departmentId: { old: null, new: created.departmentId },
        specialization: { old: null, new: created.specialization },
        licenseNumber: { old: null, new: created.licenseNumber },
        consultationFee: { old: null, new: created.consultationFee },
      },
    });

    return created;
  });
}

/**
 * Get a doctor by ID (includes user and department info).
 */
export async function getDoctorById(id) {
  const doctor = await doctorRepo.findById(id);
  if (!doctor) {
    throw new NotFoundError('Doctor', id);
  }
  return doctor;
}

/**
 * Get paginated list of doctors (filters: departmentId, search by name/specialization, isActive).
 */
export async function getDoctors(filters) {
  const { page, limit, sort, search, q, departmentId, isActive } = filters;
  const searchTerm = (search || q || '').trim();
  const orderBy = parseSortParam(sort, ALLOWED_SORT_FIELDS);
  const { skip, take } = buildPagination(page, limit);

  const where = {};

  if (departmentId) {
    where.departmentId = departmentId;
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  // Search by clinician name or specialization
  if (searchTerm) {
    where.OR = [
      { user: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
      { specialization: { contains: searchTerm, mode: 'insensitive' } },
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
 * Update a doctor profile (ADMIN only).
 */
export async function updateDoctor(id, data, auditContext) {
  const existing = await doctorRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Doctor', id);
  }

  const updateData = {};

  // If userId is being changed, validate it
  if (data.userId !== undefined && data.userId !== existing.userId) {
    if (data.userId !== null) {
      const user = await usersService.getUserById(data.userId);
      if (user.role !== ROLES.CLINICIAN) {
        throw new BusinessRuleError(
          `User must have the ${ROLES.CLINICIAN} role to be registered as a doctor`,
          [{ field: 'userId', message: `User has role '${user.role}' instead of '${ROLES.CLINICIAN}'` }],
        );
      }

      const existingProfile = await doctorRepo.findByUserId(data.userId);
      if (existingProfile && existingProfile.id !== id) {
        throw new ConflictError('This user already has a doctor profile');
      }
    }
    updateData.userId = data.userId;
  }

  // If departmentId is changed, verify it exists
  if (data.departmentId && data.departmentId !== existing.departmentId) {
    await departmentsService.getDepartmentById(data.departmentId);
    updateData.departmentId = data.departmentId;
  }

  // If licenseNumber is changed, check uniqueness
  if (data.licenseNumber && data.licenseNumber !== existing.licenseNumber) {
    const trimmedLicense = data.licenseNumber.trim();
    const duplicate = await doctorRepo.findByLicenseNumber(trimmedLicense);
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError(`A doctor with license number "${trimmedLicense}" already exists`);
    }
    updateData.licenseNumber = trimmedLicense;
  }

  if (data.specialization !== undefined) {
    updateData.specialization = data.specialization.trim();
  }

  if (data.slotDurationMin !== undefined) {
    updateData.slotDurationMin = data.slotDurationMin;
  }

  if (data.consultationFee !== undefined) {
    updateData.consultationFee = data.consultationFee;
  }

  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  // Build changes diff
  const changedFields = {};
  for (const key of Object.keys(updateData)) {
    if (String(updateData[key]) !== String(existing[key])) {
      changedFields[key] = { old: existing[key], new: updateData[key] };
    }
  }

  if (Object.keys(changedFields).length === 0) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await doctorRepo.update(id, updateData, tx);

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'UPDATE',
      entity: 'Doctor',
      entityId: id,
      changes: changedFields,
    });

    return updated;
  });
}

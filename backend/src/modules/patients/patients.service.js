import prisma from '../../infra/prisma.js';
import { NotFoundError, ForbiddenError } from '../../common/errors/index.js';
import { ROLES } from '../../common/constants/roles.js';
import { buildPagination, buildPaginationMeta, parseSortParam } from '../../common/utils/pagination.js';
import * as patientsRepo from './patients.repository.js';
import * as auditService from '../audit/audit.service.js';

const SORT_ALLOWED = ['createdAt', 'firstName', 'lastName', 'mrn', 'dateOfBirth'];

/**
 * Register a new patient (FRONT_DESK, ADMIN).
 * Auto-generates MRN safely under concurrency via DB sequence.
 */
export async function createPatient(data, auditContext) {
  const trimmedData = {
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    dateOfBirth: new Date(data.dateOfBirth),
    gender: data.gender,
    phone: data.phone.trim(),
    email: data.email ? data.email.trim() : null,
    address: data.address ? data.address.trim() : null,
    emergencyContactName: data.emergencyContactName ? data.emergencyContactName.trim() : null,
    emergencyContactPhone: data.emergencyContactPhone ? data.emergencyContactPhone.trim() : null,
  };

  return prisma.$transaction(async (tx) => {
    const mrn = await patientsRepo.generateMrn(tx);

    const created = await patientsRepo.create(
      {
        ...trimmedData,
        mrn,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'CREATE',
      entity: 'Patient',
      entityId: created.id,
      changes: {
        mrn: { old: null, new: created.mrn },
        name: { old: null, new: `${created.firstName} ${created.lastName}` },
        phone: { old: null, new: created.phone },
      },
    });

    return created;
  });
}

/**
 * Get patient by ID.
 * CLINICIAN access is scoped: only patients having an appointment or visit with that doctor (otherwise 403).
 * Every READ is audited.
 */
export async function getPatientById(id, auditContext) {
  const patient = await patientsRepo.findById(id);
  if (!patient) {
    throw new NotFoundError('Patient', id);
  }

  // CLINICIAN scoped access control
  if (auditContext.role === ROLES.CLINICIAN) {
    const doctorId = auditContext.doctorId;
    if (!doctorId) {
      throw new ForbiddenError('Clinician account has no associated doctor profile');
    }

    const hasAccess = await patientsRepo.hasDoctorAccessToPatient(doctorId, id);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this patient record');
    }
  }

  // Audit every READ of patient details
  await auditService.record({
    actor: auditContext,
    action: 'READ',
    entity: 'Patient',
    entityId: id,
    changes: {
      mrn: patient.mrn,
    },
  });

  return patient;
}

/**
 * List patients with search across name/phone/mrn, filters on gender/isActive, sort, pagination.
 * CLINICIAN access is scoped to patients associated with that doctor.
 */
export async function getPatients(filters, auditContext) {
  const { page, limit, sort, search, q, isActive, gender } = filters;
  const searchTerm = (search || q || '').trim() || undefined;
  const orderBy = parseSortParam(sort, SORT_ALLOWED);
  const { skip, take } = buildPagination(page, limit);

  let patientIds;
  if (auditContext.role === ROLES.CLINICIAN) {
    const doctorId = auditContext.doctorId;
    if (!doctorId) {
      return { data: [], meta: buildPaginationMeta(page, limit, 0) };
    }

    patientIds = await patientsRepo.findPatientIdsForDoctor(doctorId);
    if (patientIds.length === 0) {
      return { data: [], meta: buildPaginationMeta(page, limit, 0) };
    }
  }

  const [data, total] = await Promise.all([
    patientsRepo.findAll({
      skip,
      take,
      orderBy,
      search: searchTerm,
      isActive,
      gender,
      patientIds,
    }),
    patientsRepo.count({
      search: searchTerm,
      isActive,
      gender,
      patientIds,
    }),
  ]);

  return { data, meta: buildPaginationMeta(page, limit, total) };
}

/**
 * Update patient details (FRONT_DESK, ADMIN).
 * Audits every update with diff.
 */
export async function updatePatient(id, data, auditContext) {
  const existing = await patientsRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Patient', id);
  }

  const updateData = {};
  if (data.firstName !== undefined) updateData.firstName = data.firstName.trim();
  if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();
  if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth);
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.phone !== undefined) updateData.phone = data.phone.trim();
  if (data.email !== undefined) updateData.email = data.email ? data.email.trim() : null;
  if (data.address !== undefined) updateData.address = data.address ? data.address.trim() : null;
  if (data.emergencyContactName !== undefined) {
    updateData.emergencyContactName = data.emergencyContactName ? data.emergencyContactName.trim() : null;
  }
  if (data.emergencyContactPhone !== undefined) {
    updateData.emergencyContactPhone = data.emergencyContactPhone ? data.emergencyContactPhone.trim() : null;
  }
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  // Build diff
  const changedFields = {};
  for (const [key, newVal] of Object.entries(updateData)) {
    const oldVal = existing[key];
    const oldStr = oldVal instanceof Date ? oldVal.toISOString().split('T')[0] : oldVal;
    const newStr = newVal instanceof Date ? newVal.toISOString().split('T')[0] : newVal;
    if (String(oldStr) !== String(newStr)) {
      changedFields[key] = { old: oldStr, new: newStr };
    }
  }

  if (Object.keys(changedFields).length === 0) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await patientsRepo.update(id, updateData, tx);

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'UPDATE',
      entity: 'Patient',
      entityId: id,
      changes: changedFields,
    });

    return updated;
  });
}

/**
 * Soft delete patient (ADMIN only).
 */
export async function deletePatient(id, auditContext) {
  const existing = await patientsRepo.findById(id);
  if (!existing) {
    throw new NotFoundError('Patient', id);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await patientsRepo.update(
      id,
      {
        isActive: false,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'DELETE',
      entity: 'Patient',
      entityId: id,
      changes: {
        isActive: { old: existing.isActive, new: false },
      },
    });

    return updated;
  });
}

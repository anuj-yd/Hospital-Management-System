import prisma from '../../infra/prisma.js';
import { NotFoundError, ForbiddenError } from '../../common/errors/index.js';
import { ROLES } from '../../common/constants/roles.js';
import { buildPagination, buildPaginationMeta, parseSortParam } from '../../common/utils/pagination.js';
import { nowUtc } from '../../common/utils/dates.js';
import * as patientsRepo from './patients.repository.js';
import * as auditRepo from '../audit/audit.repository.js';

const SORT_ALLOWED = ['createdAt', 'firstName', 'lastName', 'mrn'];

// ─── Create ─────────────────────────────────────────────────
export async function createPatient(data, auditContext) {
  const patient = await prisma.$transaction(async (tx) => {
    const mrn = await patientsRepo.generateMrn(tx);

    const created = await patientsRepo.create(
      {
        ...data,
        mrn,
        dateOfBirth: new Date(data.dateOfBirth),
      },
      tx,
    );

    await auditRepo.createAuditLog(
      {
        userId: auditContext.userId,
        role: auditContext.role,
        action: 'CREATE',
        entity: 'Patient',
        entityId: created.id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        requestId: auditContext.requestId,
      },
      tx,
    );

    return created;
  });

  return patient;
}

// ─── Get by ID ──────────────────────────────────────────────
export async function getPatientById(id, auditContext) {
  const patient = await patientsRepo.findById(id);
  if (!patient) throw new NotFoundError('Patient', id);

  // Clinician ownership check
  if (auditContext.role === ROLES.CLINICIAN) {
    await assertClinicianOwnership(auditContext.doctorId, id);
  }

  // Audit the read
  await auditRepo.createAuditLog({
    userId: auditContext.userId,
    role: auditContext.role,
    action: 'READ',
    entity: 'Patient',
    entityId: id,
    ip: auditContext.ip,
    userAgent: auditContext.userAgent,
    requestId: auditContext.requestId,
  });

  return patient;
}

// ─── List (paginated) ───────────────────────────────────────
export async function getPatients(filters, auditContext) {
  const { page, limit, sort, search, isActive, gender } = filters;
  const orderBy = parseSortParam(sort, SORT_ALLOWED);

  let patientIds;
  if (auditContext.role === ROLES.CLINICIAN) {
    // Scope to patients with appointments/visits for this clinician
    patientIds = await patientsRepo.findPatientIdsForDoctor(auditContext.doctorId);
    if (patientIds.length === 0) {
      return { data: [], meta: buildPaginationMeta(page, limit, 0) };
    }
  }

  const { data, total } = await patientsRepo.findAll({
    page,
    limit,
    orderBy,
    search,
    isActive,
    gender,
    patientIds,
  });

  return { data, meta: buildPaginationMeta(page, limit, total) };
}

// ─── Update ─────────────────────────────────────────────────
export async function updatePatient(id, data, auditContext) {
  const existing = await patientsRepo.findById(id);
  if (!existing) throw new NotFoundError('Patient', id);

  // Build changedFields for audit (only fields that actually changed)
  const updateData = { ...data };
  if (updateData.dateOfBirth) {
    updateData.dateOfBirth = new Date(updateData.dateOfBirth);
  }

  const changedFields = {};
  for (const [key, newVal] of Object.entries(updateData)) {
    const oldVal = existing[key];
    const oldStr = oldVal instanceof Date ? oldVal.toISOString().split('T')[0] : oldVal;
    const newStr = newVal instanceof Date ? newVal.toISOString().split('T')[0] : newVal;
    if (String(oldStr) !== String(newStr)) {
      changedFields[key] = { old: oldStr, new: newStr };
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await patientsRepo.update(id, updateData, tx);

    await auditRepo.createAuditLog(
      {
        userId: auditContext.userId,
        role: auditContext.role,
        action: 'UPDATE',
        entity: 'Patient',
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

// ─── Soft Delete ────────────────────────────────────────────
export async function deletePatient(id, auditContext) {
  const existing = await patientsRepo.findById(id);
  if (!existing) throw new NotFoundError('Patient', id);

  await prisma.$transaction(async (tx) => {
    await patientsRepo.update(
      id,
      {
        isActive: false,
        deletedAt: nowUtc().toJSDate(),
      },
      tx,
    );

    await auditRepo.createAuditLog(
      {
        userId: auditContext.userId,
        role: auditContext.role,
        action: 'DELETE',
        entity: 'Patient',
        entityId: id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        requestId: auditContext.requestId,
      },
      tx,
    );
  });
}

// ─── Helper: verify clinician has access to a patient ───────
async function assertClinicianOwnership(doctorId, patientId) {
  if (!doctorId) throw new ForbiddenError('Clinician has no linked doctor record');

  const patientIds = await patientsRepo.findPatientIdsForDoctor(doctorId);
  if (!patientIds.includes(patientId)) {
    throw new ForbiddenError('You do not have access to this patient');
  }
}

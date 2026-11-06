import bcrypt from 'bcryptjs';
import prisma from '../../infra/prisma.js';
import * as usersRepo from './users.repository.js';
import * as auditRepo from '../audit/audit.repository.js';
import { NotFoundError, ConflictError, UnauthenticatedError } from '../../common/errors/index.js';
import { buildPagination, buildPaginationMeta, parseSortParam } from '../../common/utils/pagination.js';

const SALT_ROUNDS = 12;
const ALLOWED_SORT_FIELDS = ['createdAt', 'email', 'firstName', 'lastName', 'role'];

/**
 * Create a new user. Hash password, persist, audit.
 */
export async function createUser(data, auditContext) {
  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new ConflictError('DUPLICATE_EMAIL', `A user with email '${data.email}' already exists`);
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const created = await usersRepo.create(
      {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      },
      tx,
    );

    await auditRepo.createAuditLog(
      {
        ...auditContext,
        action: 'CREATE',
        entity: 'User',
        entityId: created.id,
      },
      tx,
    );

    return created;
  });

  return user;
}

/**
 * Get a single user by ID (without passwordHash).
 */
export async function getUserById(id) {
  const user = await usersRepo.findById(id);
  if (!user) throw new NotFoundError('User', id);
  return user;
}

/**
 * Get paginated list of users.
 */
export async function getUsers(filters) {
  const { page, limit, sort, search, role, isActive } = filters;
  const orderBy = parseSortParam(sort, ALLOWED_SORT_FIELDS);
  const { skip, take } = buildPagination(page, limit);

  const filterParams = { search, role, isActive };

  const [data, total] = await Promise.all([
    usersRepo.findAll({ skip, take, orderBy, ...filterParams }),
    usersRepo.count(filterParams),
  ]);

  const meta = buildPaginationMeta(page, limit, total);
  return { data, meta };
}

/**
 * Update a user's profile fields. Audit with changedFields diff.
 */
export async function updateUser(id, data, auditContext) {
  const existing = await usersRepo.findById(id);
  if (!existing) throw new NotFoundError('User', id);

  // If email is changing, check for duplicates
  if (data.email && data.email !== existing.email) {
    const duplicate = await prisma.user.findUnique({ where: { email: data.email } });
    if (duplicate) {
      throw new ConflictError('DUPLICATE_EMAIL', `A user with email '${data.email}' already exists`);
    }
  }

  // Build changedFields diff (only include fields that actually changed)
  const changedFields = {};
  for (const key of Object.keys(data)) {
    if (data[key] !== undefined && data[key] !== existing[key]) {
      changedFields[key] = { old: existing[key], new: data[key] };
    }
  }

  // Nothing changed
  if (Object.keys(changedFields).length === 0) {
    return existing;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await usersRepo.update(id, data, tx);

    await auditRepo.createAuditLog(
      {
        ...auditContext,
        action: 'UPDATE',
        entity: 'User',
        entityId: id,
        changedFields,
      },
      tx,
    );

    return result;
  });

  return updated;
}

/**
 * Change a user's password. Verify current password first.
 */
export async function changePassword(userId, currentPassword, newPassword, auditContext) {
  const user = await usersRepo.findByIdWithPassword(userId);
  if (!user) throw new NotFoundError('User', userId);

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new UnauthenticatedError('Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    await usersRepo.update(userId, { passwordHash }, tx);

    await auditRepo.createAuditLog(
      {
        ...auditContext,
        action: 'UPDATE',
        entity: 'User',
        entityId: userId,
        changedFields: { password: { old: '***', new: '***' } },
      },
      tx,
    );
  });
}


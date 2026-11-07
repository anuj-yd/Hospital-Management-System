import bcrypt from 'bcryptjs';
import prisma from '../../infra/prisma.js';
import * as usersRepo from './users.repository.js';
import * as auditService from '../audit/audit.service.js';
import { NotFoundError, ConflictError } from '../../common/errors/index.js';
import { buildPagination, buildPaginationMeta, parseSortParam } from '../../common/utils/pagination.js';

const SALT_ROUNDS = 12;
const ALLOWED_SORT_FIELDS = ['createdAt', 'email', 'fullName', 'role'];

/**
 * Create a new user (ADMIN only).
 */
export async function createUser(data, auditContext) {
  const normalizedEmail = data.email.trim().toLowerCase();

  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new ConflictError(`A user with email '${normalizedEmail}' already exists`);
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  return prisma.$transaction(async (tx) => {
    const created = await usersRepo.create(
      {
        email: normalizedEmail,
        passwordHash,
        fullName: data.fullName.trim(),
        role: data.role,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'CREATE',
      entity: 'User',
      entityId: created.id,
      changes: {
        email: { old: null, new: created.email },
        fullName: { old: null, new: created.fullName },
        role: { old: null, new: created.role },
      },
    });

    return created;
  });
}

/**
 * Get a single user by ID (never returns passwordHash).
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
  const { page, limit, sort, search, q, role, isActive } = filters;
  const searchTerm = (search || q || '').trim() || undefined;
  const orderBy = parseSortParam(sort, ALLOWED_SORT_FIELDS);
  const { skip, take } = buildPagination(page, limit);

  const filterParams = { search: searchTerm, role, isActive };

  const [data, total] = await Promise.all([
    usersRepo.findAll({ skip, take, orderBy, ...filterParams }),
    usersRepo.count(filterParams),
  ]);

  const meta = buildPaginationMeta(page, limit, total);
  return { data, meta };
}

/**
 * Update a user's role, isActive, or fullName.
 */
export async function updateUser(id, data, auditContext) {
  const existing = await usersRepo.findById(id);
  if (!existing) throw new NotFoundError('User', id);

  const updateData = {};
  if (data.fullName !== undefined) updateData.fullName = data.fullName.trim();
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  // Build diff
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
    const updated = await usersRepo.update(id, updateData, tx);

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      changes: changedFields,
    });

    return updated;
  });
}

/**
 * Reset a user's password (ADMIN only).
 */
export async function resetPassword(userId, newPassword, auditContext) {
  const user = await usersRepo.findById(userId);
  if (!user) throw new NotFoundError('User', userId);

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    await usersRepo.update(userId, { passwordHash }, tx);

    // Invalidate any active refresh tokens for the user
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await auditService.record({
      tx,
      actor: auditContext,
      action: 'UPDATE',
      entity: 'User',
      entityId: userId,
      changes: { password: { old: '***', new: '***' } },
    });
  });

  return { message: 'Password reset successfully' };
}

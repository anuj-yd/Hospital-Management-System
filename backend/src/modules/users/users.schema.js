import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';
import { ALL_ROLES } from '../../common/constants/roles.js';

/**
 * POST / — create a new user.
 */
export const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(/** @type {[string, ...string[]]} */ (ALL_ROLES)),
});

/**
 * PATCH /:id — update user (partial, no password).
 */
export const updateUserSchema = z.object({
  email: z.string().email().max(255).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(/** @type {[string, ...string[]]} */ (ALL_ROLES)).optional(),
  isActive: z.boolean().optional(),
});

/**
 * POST /:id/change-password
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

/**
 * GET / — list users query params.
 */
export const listUsersSchema = paginationSchema.merge(
  z.object({
    role: z.enum(/** @type {[string, ...string[]]} */ (ALL_ROLES)).optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  }),
);

/**
 * Param schema for UUID route params.
 */
export const userIdParamSchema = z.object({
  id: z.string().uuid(),
});


import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';
import { ALL_ROLES } from '../../common/constants/roles.js';

/**
 * POST /users — create a new user (Admin only).
 */
export const createUserSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().trim().min(1, 'Full name is required').max(150),
  role: z.enum(/** @type {[string, ...string[]]} */ (ALL_ROLES)),
});

/**
 * PATCH /users/:id — update user (role, isActive, fullName).
 */
export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name cannot be empty').max(150).optional(),
  role: z.enum(/** @type {[string, ...string[]]} */ (ALL_ROLES)).optional(),
  isActive: z.boolean().optional(),
});

/**
 * POST /users/:id/reset-password — Admin reset password.
 */
export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

/**
 * GET /users — list users query params.
 */
export const listUsersSchema = paginationSchema.merge(
  z.object({
    role: z.enum(/** @type {[string, ...string[]]} */ (ALL_ROLES)).optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    search: z.string().trim().optional(),
    q: z.string().trim().optional(),
  }),
);

/**
 * UUID route parameter schema.
 */
export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

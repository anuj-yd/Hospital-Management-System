import { z } from 'zod';

/**
 * Strong password complexity rule:
 * - Minimum 8 characters
 * - At least one uppercase letter [A-Z]
 * - At least one lowercase letter [a-z]
 * - At least one numeric digit [0-9]
 */
export const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

/**
 * POST /api/v1/auth/login schema
 */
export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address format').max(255),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/v1/auth/refresh schema
 */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/v1/auth/logout schema
 */
export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

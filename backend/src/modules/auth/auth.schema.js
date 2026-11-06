import { z } from 'zod';

/**
 * POST /login request body.
 */
export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /refresh request body.
 */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});


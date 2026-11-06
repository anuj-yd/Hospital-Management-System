import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { loginLimiter } from '../../common/middleware/rateLimiters.js';
import { loginSchema, refreshSchema, logoutSchema } from './auth.schema.js';
import * as controller from './auth.controller.js';

const router = Router();

// POST /api/v1/auth/login
router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  asyncHandler(controller.login),
);

// POST /api/v1/auth/refresh
router.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(controller.refresh),
);

// POST /api/v1/auth/logout
router.post(
  '/logout',
  authenticate,
  validate(logoutSchema),
  asyncHandler(controller.logout),
);

// GET /api/v1/auth/me
router.get(
  '/me',
  authenticate,
  asyncHandler(controller.me),
);

export default router;

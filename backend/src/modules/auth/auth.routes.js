import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { loginLimiter } from '../../common/middleware/rateLimiters.js';
import { loginSchema, refreshSchema } from './auth.schema.js';
import * as controller from './auth.controller.js';

const router = Router();

router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  asyncHandler(controller.login),
);

router.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(controller.refresh),
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(controller.logout),
);

export default router;


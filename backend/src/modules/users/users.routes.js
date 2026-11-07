import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ROLES } from '../../common/constants/roles.js';
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  listUsersSchema,
  userIdParamSchema,
} from './users.schema.js';
import * as controller from './users.controller.js';

const router = Router();

// All /users endpoints are restricted to ADMIN only
router.use(authenticate, authorize(ROLES.ADMIN));

// POST /users
router.post(
  '/',
  validate(createUserSchema),
  asyncHandler(controller.create),
);

// GET /users (search, role filter, pagination)
router.get(
  '/',
  validate(listUsersSchema, 'query'),
  asyncHandler(controller.list),
);

// GET /users/:id
router.get(
  '/:id',
  validate(userIdParamSchema, 'params'),
  asyncHandler(controller.getById),
);

// PATCH /users/:id (role, isActive, fullName)
router.patch(
  '/:id',
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema),
  asyncHandler(controller.update),
);

// POST /users/:id/reset-password
router.post(
  '/:id/reset-password',
  validate(userIdParamSchema, 'params'),
  validate(resetPasswordSchema),
  asyncHandler(controller.resetPassword),
);

export default router;

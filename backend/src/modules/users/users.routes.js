import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  listUsersSchema,
  userIdParamSchema,
} from './users.schema.js';
import * as controller from './users.controller.js';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize('users:create'),
  validate(createUserSchema),
  asyncHandler(controller.create),
);

router.get(
  '/',
  authenticate,
  authorize('users:read'),
  validate(listUsersSchema, 'query'),
  asyncHandler(controller.list),
);

router.get(
  '/:id',
  authenticate,
  authorize('users:read'),
  validate(userIdParamSchema, 'params'),
  asyncHandler(controller.getById),
);

router.patch(
  '/:id',
  authenticate,
  authorize('users:update'),
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema),
  asyncHandler(controller.update),
);

router.post(
  '/:id/change-password',
  authenticate,
  authorize('users:update'),
  validate(userIdParamSchema, 'params'),
  validate(changePasswordSchema),
  asyncHandler(controller.changePassword),
);

export default router;


import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentsSchema,
} from './departments.schema.js';
import * as controller from './departments.controller.js';

const router = Router();

// POST / — create a department
router.post(
  '/',
  authenticate,
  authorize('departments:create'),
  validate(createDepartmentSchema),
  asyncHandler(controller.create),
);

// GET / — list departments
router.get(
  '/',
  authenticate,
  authorize('departments:read'),
  validate(listDepartmentsSchema, 'query'),
  asyncHandler(controller.list),
);

// GET /:id — get a department by ID
router.get(
  '/:id',
  authenticate,
  authorize('departments:read'),
  asyncHandler(controller.getById),
);

// PATCH /:id — update a department
router.patch(
  '/:id',
  authenticate,
  authorize('departments:update'),
  validate(updateDepartmentSchema),
  asyncHandler(controller.update),
);

// DELETE /:id — soft delete a department
router.delete(
  '/:id',
  authenticate,
  authorize('departments:delete'),
  asyncHandler(controller.remove),
);

export default router;

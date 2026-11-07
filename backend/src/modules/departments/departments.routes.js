import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ROLES } from '../../common/constants/roles.js';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentsSchema,
  departmentIdParamSchema,
} from './departments.schema.js';
import * as controller from './departments.controller.js';

const router = Router();

// GET /departments — all authenticated roles can read
router.get(
  '/',
  authenticate,
  validate(listDepartmentsSchema, 'query'),
  asyncHandler(controller.list),
);

// GET /departments/:id — all authenticated roles can read
router.get(
  '/:id',
  authenticate,
  validate(departmentIdParamSchema, 'params'),
  asyncHandler(controller.getById),
);

// POST /departments — ADMIN only
router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createDepartmentSchema),
  asyncHandler(controller.create),
);

// PATCH /departments/:id — ADMIN only
router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(departmentIdParamSchema, 'params'),
  validate(updateDepartmentSchema),
  asyncHandler(controller.update),
);

export default router;

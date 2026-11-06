import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import {
  createDoctorSchema,
  updateDoctorSchema,
  listDoctorsSchema,
} from './doctors.schema.js';
import * as controller from './doctors.controller.js';

const router = Router();

// POST / — create a doctor profile
router.post(
  '/',
  authenticate,
  authorize('doctors:create'),
  validate(createDoctorSchema),
  asyncHandler(controller.create),
);

// GET / — list doctors
router.get(
  '/',
  authenticate,
  authorize('doctors:read'),
  validate(listDoctorsSchema, 'query'),
  asyncHandler(controller.list),
);

// GET /:id — get a doctor by ID
router.get(
  '/:id',
  authenticate,
  authorize('doctors:read'),
  asyncHandler(controller.getById),
);

// PATCH /:id — update a doctor profile
router.patch(
  '/:id',
  authenticate,
  authorize('doctors:update'),
  validate(updateDoctorSchema),
  asyncHandler(controller.update),
);

// DELETE /:id — soft delete a doctor
router.delete(
  '/:id',
  authenticate,
  authorize('doctors:delete'),
  asyncHandler(controller.remove),
);

export default router;

import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { createPatientSchema, updatePatientSchema, listPatientsSchema } from './patients.schema.js';
import * as controller from './patients.controller.js';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize('patients:create'),
  validate(createPatientSchema),
  controller.create,
);

router.get(
  '/',
  authenticate,
  authorize('patients:read'),
  validate(listPatientsSchema, 'query'),
  controller.list,
);

router.get(
  '/:id',
  authenticate,
  authorize('patients:read'),
  controller.getById,
);

router.patch(
  '/:id',
  authenticate,
  authorize('patients:update'),
  validate(updatePatientSchema),
  controller.update,
);

router.delete(
  '/:id',
  authenticate,
  authorize('patients:delete'),
  controller.remove,
);

export default router;

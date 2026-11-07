import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { ROLES } from '../../common/constants/roles.js';
import {
  createPatientSchema,
  updatePatientSchema,
  listPatientsSchema,
  patientIdParamSchema,
} from './patients.schema.js';
import * as controller from './patients.controller.js';

const router = Router();

// POST /patients (FRONT_DESK, ADMIN)
router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK),
  validate(createPatientSchema),
  controller.create,
);

// GET /patients (all authenticated roles; CLINICIAN is scoped in service)
router.get(
  '/',
  authenticate,
  validate(listPatientsSchema, 'query'),
  controller.list,
);

// GET /patients/:id (all authenticated roles; audited read, CLINICIAN scoped in service)
router.get(
  '/:id',
  authenticate,
  validate(patientIdParamSchema, 'params'),
  controller.getById,
);

// PATCH /patients/:id (FRONT_DESK, ADMIN)
router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK),
  validate(patientIdParamSchema, 'params'),
  validate(updatePatientSchema),
  controller.update,
);

// DELETE /patients/:id (ADMIN only, soft delete)
router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(patientIdParamSchema, 'params'),
  controller.remove,
);

export default router;

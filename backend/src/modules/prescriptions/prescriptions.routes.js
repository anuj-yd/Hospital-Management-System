import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { ROLES } from '../../common/constants/roles.js';
import {
  updatePrescriptionSchema,
  prescriptionIdParamSchema,
} from './prescriptions.schema.js';
import * as controller from './prescriptions.controller.js';

const router = Router();

router.use(authenticate);

// PATCH /prescriptions/:id (CLINICIAN, ADMIN)
router.patch(
  '/:id',
  authorize(ROLES.CLINICIAN, ROLES.ADMIN),
  validate(prescriptionIdParamSchema, 'params'),
  validate(updatePrescriptionSchema),
  controller.update,
);

// DELETE /prescriptions/:id (CLINICIAN, ADMIN)
router.delete(
  '/:id',
  authorize(ROLES.CLINICIAN, ROLES.ADMIN),
  validate(prescriptionIdParamSchema, 'params'),
  controller.remove,
);

export default router;

import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { ROLES } from '../../common/constants/roles.js';
import {
  updateDiagnosticReportSchema,
  reportIdParamSchema,
} from './diagnostic-reports.schema.js';
import * as controller from './diagnostic-reports.controller.js';

const router = Router();

router.use(authenticate);

// PATCH /diagnostic-reports/:id (CLINICIAN, ADMIN)
router.patch(
  '/:id',
  authorize(ROLES.CLINICIAN, ROLES.ADMIN),
  validate(reportIdParamSchema, 'params'),
  validate(updateDiagnosticReportSchema),
  controller.update,
);

export default router;

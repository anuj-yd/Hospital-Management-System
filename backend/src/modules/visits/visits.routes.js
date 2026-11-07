import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { ROLES } from '../../common/constants/roles.js';
import {
  createVisitSchema,
  updateVisitNotesSchema,
  visitIdParamSchema,
  patientIdParamSchema,
  listPatientVisitsSchema,
} from './visits.schema.js';
import * as controller from './visits.controller.js';

import * as prescriptionsController from '../prescriptions/prescriptions.controller.js';
import { createPrescriptionSchema } from '../prescriptions/prescriptions.schema.js';

import * as reportsController from '../diagnostic-reports/diagnostic-reports.controller.js';
import { createDiagnosticReportSchema } from '../diagnostic-reports/diagnostic-reports.schema.js';

const router = Router();

router.use(authenticate);

// 1. POST /visits (CLINICIAN who owns the appointment, or ADMIN)
router.post(
  '/',
  authorize(ROLES.CLINICIAN, ROLES.ADMIN),
  validate(createVisitSchema),
  controller.create,
);

// 2. GET /visits/:id (CLINICIAN own only -> 403; ADMIN full; FRONT_DESK metadata only)
router.get(
  '/:id',
  validate(visitIdParamSchema, 'params'),
  controller.getById,
);

// 3. PATCH /visits/:id (only while OPEN, only by owning clinician)
router.patch(
  '/:id',
  authorize(ROLES.CLINICIAN, ROLES.ADMIN),
  validate(visitIdParamSchema, 'params'),
  validate(updateVisitNotesSchema),
  controller.updateNotes,
);

// 4. POST /visits/:id/close (OPEN -> CLOSED, appointment -> COMPLETED atomically)
router.post(
  '/:id/close',
  authorize(ROLES.CLINICIAN, ROLES.ADMIN),
  validate(visitIdParamSchema, 'params'),
  controller.close,
);

// 5. Prescriptions sub-routes on visit
router.post(
  '/:id/prescriptions',
  authorize(ROLES.CLINICIAN, ROLES.ADMIN),
  validate(visitIdParamSchema, 'params'),
  validate(createPrescriptionSchema),
  prescriptionsController.create,
);

router.get(
  '/:id/prescriptions',
  authorize(ROLES.CLINICIAN, ROLES.ADMIN),
  validate(visitIdParamSchema, 'params'),
  prescriptionsController.listByVisit,
);

// 6. Diagnostic Reports sub-routes on visit
router.post(
  '/:id/diagnostic-reports',
  authorize(ROLES.CLINICIAN, ROLES.ADMIN),
  validate(visitIdParamSchema, 'params'),
  validate(createDiagnosticReportSchema),
  reportsController.create,
);

router.get(
  '/:id/diagnostic-reports',
  authorize(ROLES.CLINICIAN, ROLES.ADMIN),
  validate(visitIdParamSchema, 'params'),
  reportsController.listByVisit,
);

// 7. GET /visits/patients/:patientId
router.get(
  '/patients/:patientId',
  validate(patientIdParamSchema, 'params'),
  validate(listPatientVisitsSchema, 'query'),
  controller.getPatientVisits,
);

export default router;

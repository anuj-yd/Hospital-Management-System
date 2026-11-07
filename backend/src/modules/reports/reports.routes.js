import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ROLES } from '../../common/constants/roles.js';
import {
  appointmentsSummaryQuerySchema,
  billingSummaryQuerySchema,
} from './reports.schema.js';
import * as controller from './reports.controller.js';

const router = Router();

// All reporting endpoints require authentication
router.use(authenticate);

// 1. GET /reports/dashboard (ADMIN, FRONT_DESK)
router.get(
  '/dashboard',
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK),
  asyncHandler(controller.getDashboard),
);

// 2. GET /reports/appointments-summary (ADMIN only)
router.get(
  '/appointments-summary',
  authorize(ROLES.ADMIN),
  validate(appointmentsSummaryQuerySchema, 'query'),
  asyncHandler(controller.getAppointmentsSummary),
);

// 3. GET /reports/billing-summary (ADMIN, FRONT_DESK)
router.get(
  '/billing-summary',
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK),
  validate(billingSummaryQuerySchema, 'query'),
  asyncHandler(controller.getBillingSummary),
);

export default router;

import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ROLES } from '../../common/constants/roles.js';
import { doctorScheduleParamSchema, replaceScheduleBodySchema } from './schedules.schema.js';
import * as controller from './schedules.controller.js';

const router = Router();

// GET /schedules/:id (or /doctors/:id/schedules)
router.get(
  '/:id',
  authenticate,
  validate(doctorScheduleParamSchema, 'params'),
  asyncHandler(controller.getDoctorSchedules),
);

// PUT /schedules/:id — ADMIN only
router.put(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(doctorScheduleParamSchema, 'params'),
  validate(replaceScheduleBodySchema),
  asyncHandler(controller.replaceDoctorSchedules),
);

export default router;

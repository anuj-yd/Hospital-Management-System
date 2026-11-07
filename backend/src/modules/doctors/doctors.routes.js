import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ROLES } from '../../common/constants/roles.js';
import {
  createDoctorSchema,
  updateDoctorSchema,
  listDoctorsSchema,
  doctorIdParamSchema,
} from './doctors.schema.js';
import * as controller from './doctors.controller.js';
import * as schedulesController from '../schedules/schedules.controller.js';
import { replaceScheduleBodySchema } from '../schedules/schedules.schema.js';
import * as appointmentsController from '../appointments/appointments.controller.js';
import { getSlotsQuerySchema } from '../appointments/appointments.schema.js';

const router = Router();

// GET /doctors — all authenticated roles
router.get(
  '/',
  authenticate,
  validate(listDoctorsSchema, 'query'),
  asyncHandler(controller.list),
);

// GET /doctors/:id — all authenticated roles
router.get(
  '/:id',
  authenticate,
  validate(doctorIdParamSchema, 'params'),
  asyncHandler(controller.getById),
);

// POST /doctors — ADMIN only
router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createDoctorSchema),
  asyncHandler(controller.create),
);

// PATCH /doctors/:id — ADMIN only
router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(doctorIdParamSchema, 'params'),
  validate(updateDoctorSchema),
  asyncHandler(controller.update),
);

// GET /doctors/:id/schedules — all authenticated roles
router.get(
  '/:id/schedules',
  authenticate,
  validate(doctorIdParamSchema, 'params'),
  asyncHandler(schedulesController.getDoctorSchedules),
);

// PUT /doctors/:id/schedules — ADMIN only
router.put(
  '/:id/schedules',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(doctorIdParamSchema, 'params'),
  validate(replaceScheduleBodySchema),
  asyncHandler(schedulesController.replaceDoctorSchedules),
);

// GET /doctors/:id/slots — all authenticated roles (ADMIN, FRONT_DESK, CLINICIAN)
router.get(
  '/:id/slots',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK, ROLES.CLINICIAN),
  validate(doctorIdParamSchema, 'params'),
  validate(getSlotsQuerySchema, 'query'),
  appointmentsController.getSlots,
);

export default router;

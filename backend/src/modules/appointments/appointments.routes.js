import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { idempotency } from '../../common/middleware/idempotency.js';
import { ROLES } from '../../common/constants/roles.js';
import {
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  cancelAppointmentSchema,
  listAppointmentsSchema,
  appointmentIdParamSchema,
  getSlotsQuerySchema,
} from './appointments.schema.js';
import * as controller from './appointments.controller.js';

const router = Router();

// All appointment routes require authentication
router.use(authenticate);

// 1. GET /appointments/slots (also mounted at /doctors/:id/slots)
router.get(
  '/slots',
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK, ROLES.CLINICIAN),
  validate(getSlotsQuerySchema, 'query'),
  controller.getSlots,
);

// 2. POST /appointments (FRONT_DESK, ADMIN) with idempotency
router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK),
  idempotency(),
  validate(createAppointmentSchema),
  controller.create,
);

// 3. GET /appointments (ADMIN, FRONT_DESK, CLINICIAN)
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK, ROLES.CLINICIAN),
  validate(listAppointmentsSchema, 'query'),
  controller.list,
);

// 4. GET /appointments/:id (ADMIN, FRONT_DESK, CLINICIAN)
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK, ROLES.CLINICIAN),
  validate(appointmentIdParamSchema, 'params'),
  controller.getById,
);

// 5. PATCH /appointments/:id/reschedule (FRONT_DESK, ADMIN)
router.patch(
  '/:id/reschedule',
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK),
  idempotency(),
  validate(appointmentIdParamSchema, 'params'),
  validate(rescheduleAppointmentSchema),
  controller.reschedule,
);

// 6. POST /appointments/:id/cancel (FRONT_DESK, ADMIN, CLINICIAN)
router.post(
  '/:id/cancel',
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK, ROLES.CLINICIAN),
  validate(appointmentIdParamSchema, 'params'),
  validate(cancelAppointmentSchema),
  controller.cancel,
);

// 7. POST /appointments/:id/check-in (FRONT_DESK, ADMIN)
router.post(
  '/:id/check-in',
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK),
  validate(appointmentIdParamSchema, 'params'),
  controller.checkIn,
);

// 8. POST /appointments/:id/no-show (FRONT_DESK, ADMIN)
router.post(
  '/:id/no-show',
  authorize(ROLES.ADMIN, ROLES.FRONT_DESK),
  validate(appointmentIdParamSchema, 'params'),
  controller.noShow,
);

export default router;

import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';

const APPOINTMENT_STATUSES = ['SCHEDULED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

/**
 * GET /doctors/:id/slots query schema.
 */
export const getSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format').optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be in YYYY-MM-DD format').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be in YYYY-MM-DD format').optional(),
});

/**
 * POST /appointments schema.
 */
export const createAppointmentSchema = z.object({
  patientId: z.string().uuid('patientId must be a valid UUID'),
  doctorId: z.string().uuid('doctorId must be a valid UUID'),
  startTime: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'startTime must be a valid ISO datetime'),
  reason: z.string().trim().max(1000).optional(),
});

/**
 * PATCH /appointments/:id/reschedule schema.
 */
export const rescheduleAppointmentSchema = z.object({
  newStartTime: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'newStartTime must be a valid ISO datetime'),
  reason: z.string().trim().max(1000).optional(),
});

/**
 * POST /appointments/:id/cancel schema.
 */
export const cancelAppointmentSchema = z.object({
  cancelReason: z.string().trim().min(1, 'cancelReason is required').max(500),
});

/**
 * GET /appointments query schema.
 */
export const listAppointmentsSchema = paginationSchema.merge(
  z.object({
    doctorId: z.string().uuid().optional(),
    patientId: z.string().uuid().optional(),
    status: z.enum(/** @type {[string, ...string[]]} */ (APPOINTMENT_STATUSES)).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    search: z.string().trim().optional(),
    q: z.string().trim().optional(),
  }),
);

/**
 * UUID route parameter schema.
 */
export const appointmentIdParamSchema = z.object({
  id: z.string().uuid('Invalid appointment ID format'),
});


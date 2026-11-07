import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';

/**
 * POST /visits schema.
 */
export const createVisitSchema = z.object({
  appointmentId: z.string().uuid('appointmentId must be a valid UUID'),
});

/**
 * PATCH /visits/:id schema.
 */
export const updateVisitNotesSchema = z.object({
  chiefComplaint: z.string().trim().max(2000).optional(),
  clinicalNotes: z.string().trim().max(10000).optional(),
});

/**
 * GET /patients/:patientId/visits query schema.
 */
export const listPatientVisitsSchema = paginationSchema.merge(
  z.object({
    status: z.enum(['OPEN', 'CLOSED']).optional(),
  }),
);

/**
 * Route parameter UUID schemas.
 */
export const visitIdParamSchema = z.object({
  id: z.string().uuid('Invalid visit ID format'),
});

export const patientIdParamSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID format'),
});


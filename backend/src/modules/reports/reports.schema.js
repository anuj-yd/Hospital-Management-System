import { z } from 'zod';

export const GROUP_BY_OPTIONS = ['day', 'doctor', 'department', 'status'];

/**
 * GET /reports/appointments-summary query schema
 */
export const appointmentsSummaryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  groupBy: z
    .enum(/** @type {[string, ...string[]]} */ (GROUP_BY_OPTIONS))
    .default('status'),
});

/**
 * GET /reports/billing-summary query schema
 */
export const billingSummaryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

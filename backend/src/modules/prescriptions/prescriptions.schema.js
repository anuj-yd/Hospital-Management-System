import { z } from 'zod';

export const createPrescriptionSchema = z.object({
  medication: z.string().trim().min(1, 'Medication name is required').max(200),
  dosage: z.string().trim().min(1, 'Dosage is required (e.g., 500mg)').max(100),
  frequency: z.string().trim().min(1, 'Frequency is required (e.g., Twice daily)').max(100),
  durationDays: z
    .number()
    .int('durationDays must be an integer')
    .min(1, 'durationDays must be at least 1')
    .max(365, 'durationDays cannot exceed 365'),
  instructions: z.string().trim().max(1000).optional(),
});

export const updatePrescriptionSchema = createPrescriptionSchema.partial();

export const prescriptionIdParamSchema = z.object({
  id: z.string().uuid('Invalid prescription ID format'),
});

export const visitIdParamSchema = z.object({
  id: z.string().uuid('Invalid visit ID format'),
});


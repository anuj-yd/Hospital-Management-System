import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';

// ─── Create patient ─────────────────────────────────────────
export const createPatientSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be ISO date (YYYY-MM-DD)')
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  gender: z.string().trim().min(1, 'Gender is required').max(20),
  phone: z.string().trim().min(1, 'Phone is required').max(20),
  email: z.string().email().max(255).optional().or(z.literal('')),
  address: z.string().max(1000).optional(),
  bloodGroup: z.string().max(5).optional(),
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
});

// ─── Update patient (all fields optional) ───────────────────
export const updatePatientSchema = createPatientSchema.partial();

// ─── List / search patients ─────────────────────────────────
export const listPatientsSchema = paginationSchema.merge(
  z.object({
    search: z.string().optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    gender: z.string().optional(),
  }),
);

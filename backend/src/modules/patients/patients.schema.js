import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';

const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;

const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];

// ─── Create Patient ─────────────────────────────────────────
export const createPatientSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be ISO date (YYYY-MM-DD)')
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid date format')
    .refine((d) => new Date(d) <= new Date(), 'dateOfBirth cannot be in the future'),
  gender: z.enum(/** @type {[string, ...string[]]} */ (GENDERS)),
  phone: z
    .string()
    .trim()
    .min(7, 'Phone number must have at least 7 digits')
    .max(20, 'Phone number cannot exceed 20 characters')
    .regex(phoneRegex, 'Invalid phone number format'),
  email: z.string().trim().email('Invalid email format').max(255).optional().or(z.literal('')),
  address: z.string().trim().max(1000).optional(),
  emergencyContactName: z.string().trim().max(200).optional(),
  emergencyContactPhone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Invalid emergency contact phone number')
    .optional()
    .or(z.literal('')),
});

// ─── Update Patient ─────────────────────────────────────────
export const updatePatientSchema = createPatientSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ─── List Patients ──────────────────────────────────────────
export const listPatientsSchema = paginationSchema.merge(
  z.object({
    search: z.string().trim().optional(),
    q: z.string().trim().optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    gender: z.enum(/** @type {[string, ...string[]]} */ (GENDERS)).optional(),
  }),
);

// ─── UUID Route Param ───────────────────────────────────────
export const patientIdParamSchema = z.object({
  id: z.string().uuid('Invalid patient ID format'),
});

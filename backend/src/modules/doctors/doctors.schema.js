import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';

/**
 * Schema for creating a doctor profile.
 */
export const createDoctorSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  departmentId: z.string().uuid('departmentId must be a valid UUID'),
  specialization: z.string().trim().min(1, 'Specialization is required').max(200),
  qualification: z.string().trim().min(1, 'Qualification is required').max(300),
  licenseNumber: z.string().trim().min(1, 'License number is required').max(50),
  consultationFee: z.number().int('Consultation fee must be an integer (paise)').min(0),
});

/**
 * Schema for updating a doctor profile.
 * userId is immutable, so it is excluded.
 */
export const updateDoctorSchema = z.object({
  departmentId: z.string().uuid('departmentId must be a valid UUID').optional(),
  specialization: z.string().trim().min(1).max(200).optional(),
  qualification: z.string().trim().min(1).max(300).optional(),
  licenseNumber: z.string().trim().min(1).max(50).optional(),
  consultationFee: z.number().int('Consultation fee must be an integer (paise)').min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for listing doctors (query string).
 */
export const listDoctorsSchema = paginationSchema.merge(
  z.object({
    departmentId: z.string().uuid().optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    search: z.string().optional(),
  }),
);

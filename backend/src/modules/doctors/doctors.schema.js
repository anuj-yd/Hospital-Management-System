import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';

export const createDoctorSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID').optional().nullable(),
  departmentId: z.string().uuid('departmentId must be a valid UUID'),
  specialization: z.string().trim().min(1, 'Specialization is required').max(200),
  licenseNumber: z.string().trim().min(1, 'License number is required').max(100),
  slotDurationMin: z.number().int().min(5).max(120).default(30),
  consultationFee: z.coerce.number().min(0, 'Consultation fee must be non-negative'),
});

export const updateDoctorSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID').optional().nullable(),
  departmentId: z.string().uuid('departmentId must be a valid UUID').optional(),
  specialization: z.string().trim().min(1).max(200).optional(),
  licenseNumber: z.string().trim().min(1).max(100).optional(),
  slotDurationMin: z.number().int().min(5).max(120).optional(),
  consultationFee: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const listDoctorsSchema = paginationSchema.merge(
  z.object({
    departmentId: z.string().uuid().optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    search: z.string().trim().optional(),
    q: z.string().trim().optional(),
  }),
);

export const doctorIdParamSchema = z.object({
  id: z.string().uuid('Invalid doctor ID format'),
});

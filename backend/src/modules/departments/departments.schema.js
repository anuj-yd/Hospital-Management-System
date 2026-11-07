import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150, 'Name must be 150 characters or less'),
  description: z.string().trim().max(2000).optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listDepartmentsSchema = paginationSchema.merge(
  z.object({
    isActive: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    search: z.string().trim().optional(),
    q: z.string().trim().optional(),
  }),
);

export const departmentIdParamSchema = z.object({
  id: z.string().uuid('Invalid department ID format'),
});

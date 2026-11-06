import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';

/**
 * Schema for creating a department.
 */
export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150, 'Name must be 150 characters or less'),
  description: z.string().trim().max(2000).optional(),
});

/**
 * Schema for updating a department.
 */
export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/**
 * Schema for listing departments (query string).
 */
export const listDepartmentsSchema = paginationSchema.merge(
  z.object({
    isActive: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    search: z.string().optional(),
  }),
);

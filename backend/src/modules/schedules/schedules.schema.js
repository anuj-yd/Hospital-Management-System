import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createScheduleSchema = z.object({
  doctorId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(timeRegex, 'Must be HH:mm format'),
  endTime: z.string().regex(timeRegex, 'Must be HH:mm format'),
  slotDurationMinutes: z.number().int().min(5).max(120).default(30),
}).refine((data) => data.startTime < data.endTime, {
  message: 'startTime must be before endTime',
  path: ['endTime'],
});

export const updateScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7).optional(),
  startTime: z.string().regex(timeRegex, 'Must be HH:mm format').optional(),
  endTime: z.string().regex(timeRegex, 'Must be HH:mm format').optional(),
  slotDurationMinutes: z.number().int().min(5).max(120).optional(),
  isActive: z.boolean().optional(),
});

export const listSchedulesSchema = paginationSchema.merge(
  z.object({
    doctorId: z.string().uuid().optional(),
    dayOfWeek: z.coerce.number().int().min(1).max(7).optional(),
    isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  }),
);

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

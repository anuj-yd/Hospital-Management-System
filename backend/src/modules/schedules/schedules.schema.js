import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const scheduleItemSchema = z
  .object({
    dayOfWeek: z.number().int().min(0, 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)').max(6),
    startTime: z.string().regex(timeRegex, 'startTime must be in HH:mm format'),
    endTime: z.string().regex(timeRegex, 'endTime must be in HH:mm format'),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'startTime must be strictly before endTime',
    path: ['endTime'],
  });

export const replaceScheduleBodySchema = z.union([
  z.array(scheduleItemSchema),
  z.object({
    schedules: z.array(scheduleItemSchema),
  }).transform((val) => val.schedules),
]);

export const doctorScheduleParamSchema = z.object({
  id: z.string().uuid('Invalid doctor ID format'),
});

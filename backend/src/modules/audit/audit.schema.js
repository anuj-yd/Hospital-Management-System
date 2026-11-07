import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';

/**
 * Query params schema for listing audit logs.
 * Supports filters: userId, entity, entityId, action, from, to; pagination.
 */
export const listAuditLogsSchema = paginationSchema.merge(
  z.object({
    userId: z.string().uuid().optional(),
    action: z.string().trim().optional(),
    entity: z.string().trim().max(50).optional(),
    entityId: z.string().trim().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
);

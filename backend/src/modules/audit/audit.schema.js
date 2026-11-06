import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination.js';

/**
 * Query params schema for listing audit logs.
 */
export const listAuditLogsSchema = paginationSchema.merge(
  z.object({
    userId: z.string().uuid().optional(),
    action: z
      .enum([
        'LOGIN_SUCCESS',
        'LOGIN_FAILURE',
        'LOGOUT',
        'TOKEN_REFRESH',
        'CREATE',
        'READ',
        'UPDATE',
        'DELETE',
        'STATUS_CHANGE',
      ])
      .optional(),
    entity: z.string().max(50).optional(),
    entityId: z.string().uuid().optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
  }),
);


import * as auditRepo from './audit.repository.js';
import { buildPaginationMeta, parseSortParam } from '../../common/utils/pagination.js';

const ALLOWED_SORT_FIELDS = ['createdAt', 'action', 'entity'];

/**
 * Get paginated audit logs with filters.
 */
export async function getAuditLogs(filters) {
  const { page, limit, sort, ...rest } = filters;
  const orderBy = parseSortParam(sort, ALLOWED_SORT_FIELDS);

  const { data, total } = await auditRepo.findAll({
    page,
    limit,
    orderBy,
    ...rest,
  });

  const meta = buildPaginationMeta(page, limit, total);
  return { data, meta };
}


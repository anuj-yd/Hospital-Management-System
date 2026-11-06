import { z } from 'zod';

export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

/**
 * Zod schema for standard list query parameters.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  sort: z.string().optional(),
  search: z.string().optional(),
});

/**
 * Build Prisma skip/take from validated page & limit.
 */
export function buildPagination(page = 1, limit = DEFAULT_LIMIT) {
  const p = Math.max(1, page);
  const l = Math.min(MAX_LIMIT, Math.max(1, limit));
  return {
    skip: (p - 1) * l,
    take: l,
  };
}

/**
 * Build pagination meta object for standard responses.
 */
export function buildPaginationMeta(page, limit, total) {
  const p = Math.max(1, page);
  const l = Math.max(1, limit);
  const totalCount = Math.max(0, total);
  return {
    page: p,
    limit: l,
    total: totalCount,
    totalPages: Math.ceil(totalCount / l),
    hasPrev: p > 1,
    hasNext: p * l < totalCount,
  };
}

/**
 * Helper to parse pagination params directly from express query.
 * @param {object} query
 */
export function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
    skip: offset,
    take: limit,
    meta: (total) => buildPaginationMeta(page, limit, total),
  };
}

/**
 * Parse sort string "field:asc,field2:desc" into Prisma orderBy array.
 */
export function parseSortParam(sortStr, allowedFields = []) {
  if (!sortStr) return [{ createdAt: 'desc' }];

  return sortStr.split(',').reduce((acc, part) => {
    const [field, dir] = part.split(':');
    if (allowedFields.length === 0 || allowedFields.includes(field)) {
      acc.push({ [field]: dir === 'asc' ? 'asc' : 'desc' });
    }
    return acc;
  }, []);
}

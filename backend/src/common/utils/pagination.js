import { z } from 'zod';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * Zod schema for standard list query parameters.
 * Extend per-module with additional filters via z.intersection or .merge.
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
export function buildPagination(page, limit) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Build pagination meta object for the response.
 */
export function buildPaginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Parse sort string "field:asc,field2:desc" into Prisma orderBy.
 * Allowed fields must be provided to prevent injection.
 */
export function parseSortParam(sortStr, allowedFields) {
  if (!sortStr) return [{ createdAt: 'desc' }]; // sensible default

  return sortStr.split(',').reduce((acc, part) => {
    const [field, dir] = part.split(':');
    if (allowedFields.includes(field)) {
      acc.push({ [field]: dir === 'asc' ? 'asc' : 'desc' });
    }
    return acc;
  }, []);
}

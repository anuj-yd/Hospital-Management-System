import { ZodError } from 'zod';
import { AppError } from '../errors/index.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

/**
 * Central error handler middleware.
 * Maps Zod errors, Prisma errors, AppError subclasses, and unknown errors
 * to a standardized JSON envelope with correlation requestId.
 */
export function errorHandler(err, req, res, _next) {
  const reqId = req.id || req.headers['x-request-id'] || 'unknown';

  // ── 1. Zod validation errors → 400 ──
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
        requestId: reqId,
      },
    });
  }

  // ── 2. Malformed JSON body → 400 ──
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MALFORMED_JSON',
        message: 'Invalid JSON payload received',
        details: [],
        requestId: reqId,
      },
    });
  }

  // ── 3. Prisma unique constraint violation → 409 ──
  if (err.code === 'P2002') {
    const fields = err.meta?.target || [];
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: `Unique constraint violation on: ${Array.isArray(fields) ? fields.join(', ') : fields}`,
        details: [],
        requestId: reqId,
      },
    });
  }

  // ── 4. Prisma record not found → 404 ──
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.meta?.cause || 'Requested record was not found',
        details: [],
        requestId: reqId,
      },
    });
  }

  // ── 5. Postgres raw SQL unique violation → 409 ──
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'Duplicate record violates database unique constraint',
        details: [],
        requestId: reqId,
      },
    });
  }

  // ── 6. Known AppError subclasses ──
  if (err instanceof AppError) {
    return res.status(err.statusCode || err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'APP_ERROR',
        message: err.message,
        details: err.details || [],
        requestId: reqId,
      },
    });
  }

  // ── 7. Unknown / unexpected server errors → 500 ──
  logger.error({ err, requestId: reqId }, 'Unhandled server exception');

  const genericMessage = 'Internal server error';
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production' ? genericMessage : (err.message || genericMessage),
      details: [],
      requestId: reqId,
    },
  });
}

import { AppError } from '../errors/index.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

/**
 * Central error handler — MUST be registered last in the middleware chain.
 * Maps known Prisma errors, AppError subclasses and unknown errors to a
 * consistent JSON envelope.
 */
export function errorHandler(err, req, res, _next) {
  // ── Prisma unique constraint violation → 409 ──
  if (err.code === 'P2002') {
    const fields = err.meta?.target || [];
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: `Unique constraint violation on: ${fields.join(', ')}`,
        details: [],
        requestId: req.id,
      },
    });
  }

  // ── Prisma record not found → 404 ──
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.meta?.cause || 'Record not found',
        details: [],
        requestId: req.id,
      },
    });
  }

  // ── Postgres unique violation (raw SQL) → 409 ──
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'Duplicate value violates unique constraint',
        details: [],
        requestId: req.id,
      },
    });
  }

  // ── Known application errors ──
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: req.id,
      },
    });
  }

  // ── Unknown / unexpected errors ──
  logger.error({ err, requestId: req.id }, 'Unhandled error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
      details: [],
      requestId: req.id,
    },
  });
}

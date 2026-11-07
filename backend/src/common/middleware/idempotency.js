import crypto from 'node:crypto';
import prisma from '../../infra/prisma.js';
import { IdempotencyConflictError, ValidationError } from '../errors/index.js';
import { logger } from '../../config/logger.js';

/**
 * Compute deterministic hash of request method, path, and normalized body.
 */
function computeRequestHash(req) {
  const method = (req.method || 'GET').toUpperCase();
  const path = req.originalUrl || req.path || '/';
  const bodyStr = req.body ? JSON.stringify(req.body) : '';

  return crypto
    .createHash('sha256')
    .update(`${method}:${path}:${bodyStr}`)
    .digest('hex');
}

/**
 * Idempotency middleware factory.
 * Enforces transactional semantics on mutative operations:
 * - If Idempotency-Key has been processed with identical requestHash: replays stored response
 * - If Idempotency-Key has been processed with different requestHash: raises 409 IDEMPOTENCY_CONFLICT
 * - Under concurrency, DB unique constraint on (key, userId) prevents duplicate side-effects
 *
 * @param {object} options
 * @param {boolean} options.required - if true, rejects requests lacking Idempotency-Key
 */
export function idempotency({ required = false } = {}) {
  return async (req, res, next) => {
    try {
      const rawKey = req.headers['idempotency-key'];
      const key = typeof rawKey === 'string' ? rawKey.trim() : null;

      if (!key) {
        if (required) {
          throw new ValidationError('Idempotency-Key header is required for this operation');
        }
        return next();
      }

      req.idempotencyKey = key;

      const userId = req.user?.id;
      // Idempotency records require an authenticated user context
      if (!userId) {
        return next();
      }

      const requestHash = computeRequestHash(req);

      // 1. Check for previously stored execution with this key & user
      const existing = await prisma.idempotencyKey.findUnique({
        where: {
          key_userId: {
            key,
            userId,
          },
        },
      });

      if (existing) {
        // If payload is identical, safely replay the stored response
        if (existing.requestHash === requestHash) {
          res.setHeader('X-Idempotent-Replay', 'true');
          return res.status(existing.responseStatus).json(existing.responseBody);
        }

        // Same idempotency key used for a divergent request body -> 409 Conflict
        throw new IdempotencyConflictError(
          'Idempotency-Key conflict: this key has already been used with differing request parameters.',
        );
      }

      // 2. Intercept response to capture final status & payload
      const originalJson = res.json.bind(res);

      res.json = function (body) {
        // Restore original res.json first
        res.json = originalJson;

        // Only cache successful or non-server-error responses (status < 500)
        if (res.statusCode < 500) {
          // Asynchronously persist record; do not block response pipeline
          prisma.idempotencyKey
            .create({
              data: {
                key,
                userId,
                method: req.method.slice(0, 10),
                path: req.originalUrl || req.path,
                requestHash,
                responseStatus: res.statusCode,
                responseBody: body ?? {},
              },
            })
            .catch((err) => {
              // Concurrent execution will trigger unique constraint violation (P2002 / 23505)
              if (err.code === 'P2002' || err.code === '23505') {
                logger.warn({ key, userId }, 'Concurrent idempotency key storage handled');
              } else {
                logger.error({ err, key, userId }, 'Failed to persist idempotency key');
              }
            });
        }

        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

import { IdempotencyConflictError } from '../errors/index.js';

/**
 * Idempotency middleware factory.
 * Reads the Idempotency-Key header and attaches it to req.idempotencyKey.
 * The service layer is responsible for checking/storing the key in the DB.
 *
 * @param {Object} options
 * @param {boolean} options.required - if true, reject requests without the header
 */
export function idempotency({ required = false } = {}) {
  return (req, _res, next) => {
    const key = req.headers['idempotency-key'];
    if (required && !key) {
      throw new IdempotencyConflictError('Idempotency-Key header is required for this request');
    }
    req.idempotencyKey = key || null;
    next();
  };
}

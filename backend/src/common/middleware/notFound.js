import { NotFoundError } from '../errors/index.js';

/**
 * Catch-all for routes that don't match any handler.
 */
export function notFound(req, _res, _next) {
  throw new NotFoundError('Route', `${req.method} ${req.originalUrl}`);
}

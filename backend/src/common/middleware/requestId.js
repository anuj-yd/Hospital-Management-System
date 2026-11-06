import { v4 as uuidv4 } from 'uuid';

/**
 * Attach a unique request ID to every request.
 * Reads X-Request-Id header if present, otherwise generates one.
 */
export function requestId(req, _res, next) {
  req.id = req.headers['x-request-id'] || uuidv4();
  next();
}

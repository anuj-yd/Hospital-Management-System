import { AsyncLocalStorage } from 'node:async_hooks';

export const requestContext = new AsyncLocalStorage();

/**
 * Retrieve current execution store or an empty fallback object.
 */
export function getRequestContext() {
  return requestContext.getStore() || {};
}

/**
 * Merge updates into active execution context (e.g. after authentication).
 */
export function setRequestContext(updates = {}) {
  const store = requestContext.getStore();
  if (store) {
    Object.assign(store, updates);
  }
}

/**
 * Express middleware to initialize request context.
 */
export function requestContextMiddleware(req, res, next) {
  const store = {
    requestId: req.id,
    ip: req.ip || req.socket?.remoteAddress || '127.0.0.1',
    userAgent: req.get('user-agent') || 'unknown',
    userId: null,
    role: null,
  };

  requestContext.run(store, () => next());
}


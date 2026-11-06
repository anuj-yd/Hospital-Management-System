import { PERMISSIONS } from '../constants/permissions.js';
import { ForbiddenError } from '../errors/index.js';

/**
 * RBAC middleware factory.
 * Usage: authorize('patients:create')
 *
 * Checks the authenticated user's role against the permission matrix.
 * Must be used AFTER authenticate middleware.
 */
export function authorize(permission) {
  return (req, _res, next) => {
    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) {
      // Programming error — unknown permission
      throw new Error(`Unknown permission: ${permission}`);
    }

    if (!req.user || !allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError();
    }

    next();
  };
}

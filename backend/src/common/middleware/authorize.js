import { hasPermission } from '../constants/permissions.js';
import { ForbiddenError, UnauthenticatedError } from '../errors/index.js';

/**
 * RBAC authorization middleware factory.
 * Accepts one or multiple permission keys.
 * User must possess at least one of the required permissions.
 *
 * Usage:
 *   authorize('patient:read')
 *   authorize('patient:write', 'appointment:write')
 *
 * MUST be applied AFTER authenticate middleware.
 */
export function authorize(...permissions) {
  if (permissions.length === 0) {
    throw new Error('authorize() middleware requires at least one permission argument');
  }

  return (req, _res, next) => {
    try {
      if (!req.user || !req.user.role) {
        throw new UnauthenticatedError('Authentication required to verify permissions');
      }

      const isAllowed = permissions.some((permission) =>
        hasPermission(req.user.role, permission),
      );

      if (!isAllowed) {
        throw new ForbiddenError(
          `Access denied. Role '${req.user.role}' lacks required permission: ${permissions.join(' or ')}`,
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

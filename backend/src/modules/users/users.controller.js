import * as usersService from './users.service.js';
import { success, created, paginated, noContent } from '../../common/utils/response.js';

/**
 * Build audit context from the request object.
 */
function auditContext(req) {
  return {
    userId: req.user.id,
    role: req.user.role,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? null,
    requestId: req.id ?? null,
  };
}

/**
 * POST / — create user.
 */
export async function create(req, res) {
  const user = await usersService.createUser(req.body, auditContext(req));
  return created(res, user);
}

/**
 * GET /:id — get user by ID.
 */
export async function getById(req, res) {
  const user = await usersService.getUserById(req.params.id);
  return success(res, user);
}

/**
 * GET / — list users.
 */
export async function list(req, res) {
  const { data, meta } = await usersService.getUsers(req.query);
  return paginated(res, data, meta);
}

/**
 * PATCH /:id — update user.
 */
export async function update(req, res) {
  const user = await usersService.updateUser(req.params.id, req.body, auditContext(req));
  return success(res, user);
}

/**
 * POST /:id/change-password
 */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  await usersService.changePassword(req.params.id, currentPassword, newPassword, auditContext(req));
  return noContent(res);
}


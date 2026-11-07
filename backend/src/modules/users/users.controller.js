import * as usersService from './users.service.js';
import { success, created, paginated } from '../../common/utils/response.js';

function auditContext(req) {
  return {
    id: req.user.id,
    role: req.user.role,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? null,
    requestId: req.id ?? null,
  };
}

/**
 * POST /users — create user.
 */
export async function create(req, res) {
  const user = await usersService.createUser(req.body, auditContext(req));
  return created(res, user);
}

/**
 * GET /users/:id — get user by ID.
 */
export async function getById(req, res) {
  const user = await usersService.getUserById(req.params.id);
  return success(res, user);
}

/**
 * GET /users — list users with search, role filter, and pagination.
 */
export async function list(req, res) {
  const { data, meta } = await usersService.getUsers(req.query);
  return paginated(res, data, meta);
}

/**
 * PATCH /users/:id — update user (role, isActive, fullName).
 */
export async function update(req, res) {
  const user = await usersService.updateUser(req.params.id, req.body, auditContext(req));
  return success(res, user);
}

/**
 * POST /users/:id/reset-password — Admin reset password.
 */
export async function resetPassword(req, res) {
  const result = await usersService.resetPassword(
    req.params.id,
    req.body.newPassword,
    auditContext(req),
  );
  return success(res, result);
}

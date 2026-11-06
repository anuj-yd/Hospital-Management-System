import * as authService from './auth.service.js';
import { success, noContent } from '../../common/utils/response.js';

/**
 * Build audit context from the request object.
 */
function auditContext(req) {
  return {
    userId: req.user?.id ?? null,
    role: req.user?.role ?? null,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? null,
    requestId: req.id ?? null,
  };
}

/**
 * POST /login
 */
export async function login(req, res) {
  const { email, password } = req.body;
  const result = await authService.login(email, password, auditContext(req));
  return success(res, result);
}

/**
 * POST /refresh
 */
export async function refresh(req, res) {
  const { refreshToken } = req.body;
  const result = await authService.refresh(refreshToken, auditContext(req));
  return success(res, result);
}

/**
 * POST /logout
 */
export async function logout(req, res) {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken, auditContext(req));
  return noContent(res);
}


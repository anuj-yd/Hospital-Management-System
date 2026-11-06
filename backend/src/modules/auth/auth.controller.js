import * as authService from './auth.service.js';
import { ok, noContent } from '../../common/utils/response.js';

function extractReqMeta(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress || '127.0.0.1',
    userAgent: req.get('user-agent') || 'unknown',
    requestId: req.id || req.headers['x-request-id'] || 'unknown',
  };
}

/**
 * POST /api/v1/auth/login
 */
export async function login(req, res) {
  const { email, password } = req.body;
  const result = await authService.login(email, password, extractReqMeta(req));
  return ok(res, result);
}

/**
 * POST /api/v1/auth/refresh
 */
export async function refresh(req, res) {
  const { refreshToken } = req.body;
  const result = await authService.refresh(refreshToken, extractReqMeta(req));
  return ok(res, result);
}

/**
 * POST /api/v1/auth/logout
 */
export async function logout(req, res) {
  const { refreshToken } = req.body || {};
  await authService.logout(refreshToken, req.user?.id, extractReqMeta(req));
  return noContent(res);
}

/**
 * GET /api/v1/auth/me
 */
export async function me(req, res) {
  const user = await authService.me(req.user.id);
  return ok(res, user);
}

import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { UnauthenticatedError } from '../errors/index.js';

/**
 * Express middleware: verifies the Bearer JWT access token
 * and attaches the decoded payload to req.user.
 */
export function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthenticatedError('Missing or malformed Authorization header');
  }

  const token = header.slice(7); // strip "Bearer "
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      doctorId: payload.doctorId || null,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new UnauthenticatedError('Access token has expired');
    }
    throw new UnauthenticatedError('Invalid access token');
  }
}

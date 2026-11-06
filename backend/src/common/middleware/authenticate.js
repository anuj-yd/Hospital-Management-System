import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import prisma from '../../infra/prisma.js';
import { UnauthenticatedError, ForbiddenError } from '../errors/index.js';
import { setRequestContext } from '../context/requestContext.js';

/**
 * Express middleware:
 * 1. Verifies Bearer JWT access token
 * 2. Loads fresh user record from the database
 * 3. Rejects inactive or deleted accounts
 * 4. Populates req.user and AsyncLocalStorage context
 */
export async function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthenticatedError('Missing or malformed Authorization header');
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new UnauthenticatedError('Missing bearer token');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new UnauthenticatedError('Access token has expired');
    }
    throw new UnauthenticatedError('Invalid or malformed access token');
  }

  const userId = payload.sub || payload.id;
  if (!userId) {
    throw new UnauthenticatedError('Token missing subject identifier');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      doctor: {
        select: {
          id: true,
          departmentId: true,
          specialization: true,
          licenseNumber: true,
          isActive: true,
        },
      },
    },
  });

  if (!user) {
    throw new UnauthenticatedError('User account no longer exists');
  }

  if (!user.isActive) {
    throw new ForbiddenError('User account is deactivated. Contact an administrator.');
  }

  req.user = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    doctorId: user.doctor?.id || null,
    departmentId: user.doctor?.departmentId || null,
  };

  // Populate AsyncLocalStorage store for deep service tracing & audit logs
  setRequestContext({
    userId: user.id,
    role: user.role,
  });

  next();
}

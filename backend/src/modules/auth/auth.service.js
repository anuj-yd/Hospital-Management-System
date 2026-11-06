import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { UnauthenticatedError, ForbiddenError } from '../../common/errors/index.js';
import { parseDurationMs } from '../../common/utils/dates.js';
import prisma from '../../infra/prisma.js';
import * as authRepo from './auth.repository.js';
import * as auditService from '../audit/audit.service.js';

/**
 * Compute SHA-256 hash of raw refresh token for safe database persistence.
 * @param {string} token
 * @returns {string} hex hash
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a signed JWT access token.
 */
export function generateAccessToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    doctorId: user.doctor?.id ?? null,
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  });
}

/**
 * Generate a cryptographically secure random refresh token string.
 */
export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

/**
 * Login: validates credentials, issues token pair, stores hashed refresh token, audits.
 * Uses generic "Invalid credentials" response to eliminate user enumeration vulnerability.
 */
export async function login(email, password, reqMeta = {}) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = await authRepo.findUserByEmail(normalizedEmail);

  // 1. Email not registered
  if (!user) {
    await auditService.record({
      action: 'LOGIN_FAILURE',
      entity: 'User',
      entityId: null,
      changes: { reason: 'User not found', email: normalizedEmail },
      req: reqMeta,
    });
    // Generic message — prevents user enumeration
    throw new UnauthenticatedError('Invalid credentials');
  }

  // 2. Account deactivated
  if (!user.isActive) {
    await auditService.record({
      actor: { id: user.id, role: user.role },
      action: 'LOGIN_FAILURE',
      entity: 'User',
      entityId: user.id,
      changes: { reason: 'Account deactivated' },
      req: reqMeta,
    });
    // Generic message — prevents status enumeration
    throw new UnauthenticatedError('Invalid credentials');
  }

  // 3. Password verification
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    await auditService.record({
      actor: { id: user.id, role: user.role },
      action: 'LOGIN_FAILURE',
      entity: 'User',
      entityId: user.id,
      changes: { reason: 'Password mismatch' },
      req: reqMeta,
    });
    throw new UnauthenticatedError('Invalid credentials');
  }

  // 4. Token pair generation
  const accessToken = generateAccessToken(user);
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_TTL));

  // 5. Store refresh token, update lastLoginAt, and record audit atomically
  await prisma.$transaction(async (tx) => {
    await authRepo.createRefreshToken(
      {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
      tx,
    );

    await authRepo.updateUserLastLogin(user.id, tx);

    await auditService.record({
      tx,
      actor: { id: user.id, role: user.role },
      action: 'LOGIN_SUCCESS',
      entity: 'User',
      entityId: user.id,
      req: reqMeta,
    });
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      doctorId: user.doctor?.id ?? null,
    },
  };
}

/**
 * Refresh: verifies token, performs rotation, and detects reuse breach.
 * If a revoked token is presented, all user sessions are immediately revoked (theft detection).
 */
export async function refresh(rawRefreshToken, reqMeta = {}) {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    throw new UnauthenticatedError('Refresh token is required');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const storedToken = await authRepo.findRefreshTokenByHash(tokenHash);

  // 1. Unknown token
  if (!storedToken) {
    throw new UnauthenticatedError('Invalid or expired refresh token');
  }

  // 2. Token reuse detection (Security violation!)
  if (storedToken.revokedAt !== null) {
    // Revoke all remaining active tokens for this user
    await authRepo.revokeAllUserRefreshTokens(storedToken.userId);

    await auditService.record({
      actor: { id: storedToken.userId, role: storedToken.user?.role },
      action: 'TOKEN_REUSE_DETECTED',
      entity: 'RefreshToken',
      entityId: storedToken.id,
      changes: {
        warning: 'Revoked refresh token presented. All user sessions invalidated for security.',
      },
      req: reqMeta,
    });

    throw new UnauthenticatedError('Invalid or expired refresh token');
  }

  // 3. Expired token
  if (storedToken.expiresAt < new Date()) {
    await authRepo.revokeRefreshToken(storedToken.id);
    throw new UnauthenticatedError('Refresh token has expired');
  }

  // 4. User account state check
  const { user } = storedToken;
  if (!user || !user.isActive) {
    throw new ForbiddenError('User account is deactivated');
  }

  // 5. Generate fresh token pair
  const newAccessToken = generateAccessToken(user);
  const newRawRefreshToken = generateRefreshToken();
  const newTokenHash = hashToken(newRawRefreshToken);
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_TTL));

  // 6. Rotate: revoke old token and insert new token in single transaction
  await prisma.$transaction(async (tx) => {
    await authRepo.revokeRefreshToken(storedToken.id, tx);
    await authRepo.createRefreshToken(
      {
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt,
      },
      tx,
    );

    await auditService.record({
      tx,
      actor: { id: user.id, role: user.role },
      action: 'TOKEN_REFRESH',
      entity: 'RefreshToken',
      entityId: storedToken.id,
      req: reqMeta,
    });
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
  };
}

/**
 * Logout: revokes refresh token session and audits.
 */
export async function logout(rawRefreshToken, currentUserId, reqMeta = {}) {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    const storedToken = await authRepo.findRefreshTokenByHash(tokenHash);

    if (storedToken && storedToken.revokedAt === null) {
      await prisma.$transaction(async (tx) => {
        await authRepo.revokeRefreshToken(storedToken.id, tx);
        await auditService.record({
          tx,
          actor: { id: storedToken.userId, role: storedToken.user?.role },
          action: 'LOGOUT',
          entity: 'RefreshToken',
          entityId: storedToken.id,
          req: reqMeta,
        });
      });
      return;
    }
  }

  // Fallback: revoke all sessions for authenticated caller
  if (currentUserId) {
    await prisma.$transaction(async (tx) => {
      await authRepo.revokeAllUserRefreshTokens(currentUserId, tx);
      await auditService.record({
        tx,
        actor: { id: currentUserId },
        action: 'LOGOUT',
        entity: 'User',
        entityId: currentUserId,
        req: reqMeta,
      });
    });
  }
}

/**
 * Retrieve authenticated user profile with latest roles & doctor affiliations.
 */
export async function me(userId) {
  const user = await authRepo.findUserById(userId);
  if (!user || !user.isActive) {
    throw new UnauthenticatedError('User account not found or deactivated');
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    doctor: user.doctor
      ? {
          id: user.doctor.id,
          departmentId: user.doctor.departmentId,
          specialization: user.doctor.specialization,
          licenseNumber: user.doctor.licenseNumber,
        }
      : null,
  };
}

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { UnauthenticatedError } from '../../common/errors/index.js';
import prisma from '../../infra/prisma.js';
import * as authRepo from './auth.repository.js';
import * as auditRepo from '../audit/audit.repository.js';

/**
 * Parse a duration string like "15m", "7d", "1h" into milliseconds.
 */
function parseDurationMs(str) {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration format: ${str}`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit];
}

/**
 * Hash a raw refresh token with SHA-256.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a signed JWT access token.
 */
function generateAccessToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    doctorId: user.doctor?.id ?? null,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

/**
 * Generate a random refresh token (hex string).
 */
function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

/**
 * Login: verify credentials, generate tokens, store hashed refresh token, audit.
 */
export async function login(email, password, auditContext) {
  const user = await authRepo.findUserByEmail(email);

  // Invalid email
  if (!user) {
    await auditRepo.createAuditLog({
      ...auditContext,
      action: 'LOGIN_FAILURE',
      entity: 'User',
      entityId: null,
      changedFields: { reason: 'Invalid email' },
    });
    throw new UnauthenticatedError('Invalid email or password');
  }

  // Account deactivated
  if (!user.isActive) {
    await auditRepo.createAuditLog({
      ...auditContext,
      userId: user.id,
      role: user.role,
      action: 'LOGIN_FAILURE',
      entity: 'User',
      entityId: user.id,
      changedFields: { reason: 'Account deactivated' },
    });
    throw new UnauthenticatedError('Account is deactivated');
  }

  // Wrong password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    await auditRepo.createAuditLog({
      ...auditContext,
      userId: user.id,
      role: user.role,
      action: 'LOGIN_FAILURE',
      entity: 'User',
      entityId: user.id,
      changedFields: { reason: 'Invalid password' },
    });
    throw new UnauthenticatedError('Invalid email or password');
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN));

  // Store refresh token and audit in one transaction
  await prisma.$transaction(async (tx) => {
    await authRepo.createRefreshToken(
      { userId: user.id, tokenHash, expiresAt },
      tx,
    );
    await auditRepo.createAuditLog(
      {
        ...auditContext,
        userId: user.id,
        role: user.role,
        action: 'LOGIN_SUCCESS',
        entity: 'User',
        entityId: user.id,
      },
      tx,
    );
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  };
}

/**
 * Refresh: verify refresh token, rotate (revoke old, create new), return new pair, audit.
 */
export async function refresh(refreshToken, auditContext) {
  const tokenHash = hashToken(refreshToken);
  const storedToken = await authRepo.findRefreshTokenByHash(tokenHash);

  if (!storedToken) {
    throw new UnauthenticatedError('Invalid or expired refresh token');
  }

  const { user } = storedToken;

  if (!user.isActive) {
    throw new UnauthenticatedError('Account is deactivated');
  }

  // Generate new token pair
  const accessToken = generateAccessToken(user);
  const newRawRefreshToken = generateRefreshToken();
  const newTokenHash = hashToken(newRawRefreshToken);
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN));

  // Rotate: revoke old, create new, audit — all in one transaction
  await prisma.$transaction(async (tx) => {
    await authRepo.revokeRefreshToken(storedToken.id, tx);
    await authRepo.createRefreshToken(
      { userId: user.id, tokenHash: newTokenHash, expiresAt },
      tx,
    );
    await auditRepo.createAuditLog(
      {
        ...auditContext,
        userId: user.id,
        role: user.role,
        action: 'TOKEN_REFRESH',
        entity: 'RefreshToken',
        entityId: storedToken.id,
      },
      tx,
    );
  });

  return {
    accessToken,
    refreshToken: newRawRefreshToken,
  };
}

/**
 * Logout: revoke the provided refresh token, audit.
 */
export async function logout(refreshToken, auditContext) {
  const tokenHash = hashToken(refreshToken);
  const storedToken = await authRepo.findRefreshTokenByHash(tokenHash);

  // Silently succeed if token not found (already revoked or expired)
  if (!storedToken) return;

  await prisma.$transaction(async (tx) => {
    await authRepo.revokeRefreshToken(storedToken.id, tx);
    await auditRepo.createAuditLog(
      {
        ...auditContext,
        action: 'LOGOUT',
        entity: 'RefreshToken',
        entityId: storedToken.id,
      },
      tx,
    );
  });
}


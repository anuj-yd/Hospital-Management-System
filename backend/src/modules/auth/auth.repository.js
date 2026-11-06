import prisma from '../../infra/prisma.js';

/**
 * Find a user by email, including the related doctor record.
 */
export async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
    include: { doctor: { select: { id: true } } },
  });
}

/**
 * Create a refresh token record.
 */
export async function createRefreshToken(data, tx) {
  const db = tx || prisma;
  return db.refreshToken.create({
    data: {
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
    },
  });
}

/**
 * Find a non-revoked, non-expired refresh token by its SHA-256 hash.
 */
export async function findRefreshTokenByHash(hash) {
  return prisma.refreshToken.findFirst({
    where: {
      tokenHash: hash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          doctor: { select: { id: true } },
        },
      },
    },
  });
}

/**
 * Revoke a single refresh token by setting revokedAt.
 */
export async function revokeRefreshToken(id, tx) {
  const db = tx || prisma;
  return db.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke all refresh tokens for a given user.
 */
export async function revokeAllUserTokens(userId, tx) {
  const db = tx || prisma;
  return db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}


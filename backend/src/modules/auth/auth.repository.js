import prisma from '../../infra/prisma.js';

/**
 * Retrieve user by email address with affiliated doctor metadata.
 */
export async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
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
}

/**
 * Retrieve user by primary key ID.
 */
export async function findUserById(id) {
  return prisma.user.findUnique({
    where: { id },
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
}

/**
 * Update the user's last login timestamp.
 */
export async function updateUserLastLogin(id, tx) {
  const db = tx || prisma;
  return db.user.update({
    where: { id },
    data: { lastLoginAt: new Date() },
  });
}

/**
 * Create a new refresh token record.
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
 * Find a refresh token record by tokenHash.
 * Returns the record regardless of revocation status to enable token reuse attack detection.
 */
export async function findRefreshTokenByHash(tokenHash) {
  return prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          doctor: { select: { id: true, departmentId: true } },
        },
      },
    },
  });
}

/**
 * Revoke a single refresh token by ID.
 */
export async function revokeRefreshToken(id, tx) {
  const db = tx || prisma;
  return db.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

/**
 * Security: Revoke all active refresh tokens for a user (triggered on token reuse breach).
 */
export async function revokeAllUserRefreshTokens(userId, tx) {
  const db = tx || prisma;
  return db.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

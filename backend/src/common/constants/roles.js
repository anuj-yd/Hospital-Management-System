/**
 * Role constants — single source of truth.
 * Mirrors the Prisma Role enum.
 */
export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  FRONT_DESK: 'FRONT_DESK',
  CLINICIAN: 'CLINICIAN',
});

export const ALL_ROLES = Object.freeze(Object.values(ROLES));

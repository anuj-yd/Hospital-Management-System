import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env.js';
import { ROLES } from '../../src/common/constants/roles.js';

export const TEST_USERS = {
  ADMIN: {
    id: '10000000-0000-0000-0000-000000000001',
    role: ROLES.ADMIN,
    email: 'admin@hms.test',
  },
  FRONT_DESK: {
    id: '10000000-0000-0000-0000-000000000002',
    role: ROLES.FRONT_DESK,
    email: 'frontdesk1@hms.test',
  },
  CLINICIAN: {
    id: '10000000-0000-0000-0000-000000000004',
    role: ROLES.CLINICIAN,
    email: 'dr.sharma@hms.test',
    doctorId: '30000000-0000-0000-0000-000000000001',
  },
  CLINICIAN_B: {
    id: '10000000-0000-0000-0000-000000000005',
    role: ROLES.CLINICIAN,
    email: 'dr.patel@hms.test',
    doctorId: '30000000-0000-0000-0000-000000000002',
  },
};

/**
 * Generate a valid signed JWT access token for a given role or custom user.
 */
export function getAuthToken(role = ROLES.ADMIN, overrides = {}) {
  const user = TEST_USERS[role] || TEST_USERS.ADMIN;
  const payload = {
    sub: overrides.id || user.id,
    role: overrides.role || user.role,
    email: overrides.email || user.email,
    doctorId: overrides.doctorId !== undefined ? overrides.doctorId : (user.doctorId || null),
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
}

/**
 * Generate an expired JWT token for negative test verification.
 */
export function getExpiredToken() {
  return jwt.sign(
    { sub: 'expired-user-id', role: ROLES.ADMIN, email: 'expired@hms.test' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '-10s' },
  );
}


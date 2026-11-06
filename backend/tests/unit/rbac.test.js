import { describe, it, expect } from '@jest/globals';
import { PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from '../../src/common/constants/permissions.js';
import { ROLES } from '../../src/common/constants/roles.js';

describe('RBAC & Permission Matrix Unit Tests', () => {
  it('grants full administrative access to ADMIN role', () => {
    expect(hasPermission(ROLES.ADMIN, PERMISSIONS.PATIENT_READ)).toBe(true);
    expect(hasPermission(ROLES.ADMIN, PERMISSIONS.PATIENT_WRITE)).toBe(true);
    expect(hasPermission(ROLES.ADMIN, PERMISSIONS.CLINICAL_WRITE)).toBe(true);
    expect(hasPermission(ROLES.ADMIN, PERMISSIONS.INVOICE_WRITE)).toBe(true);
    expect(hasPermission(ROLES.ADMIN, PERMISSIONS.AUDIT_READ)).toBe(true);
    expect(hasPermission(ROLES.ADMIN, PERMISSIONS.USER_MANAGE)).toBe(true);
  });

  it('restricts FRONT_DESK from clinical writes and user administration', () => {
    expect(hasPermission(ROLES.FRONT_DESK, PERMISSIONS.PATIENT_READ)).toBe(true);
    expect(hasPermission(ROLES.FRONT_DESK, PERMISSIONS.PATIENT_WRITE)).toBe(true);
    expect(hasPermission(ROLES.FRONT_DESK, PERMISSIONS.INVOICE_WRITE)).toBe(true);
    expect(hasPermission(ROLES.FRONT_DESK, PERMISSIONS.PAYMENT_WRITE)).toBe(true);

    // Forbidden for FRONT_DESK
    expect(hasPermission(ROLES.FRONT_DESK, PERMISSIONS.CLINICAL_WRITE)).toBe(false);
    expect(hasPermission(ROLES.FRONT_DESK, PERMISSIONS.VISIT_WRITE)).toBe(false);
    expect(hasPermission(ROLES.FRONT_DESK, PERMISSIONS.USER_MANAGE)).toBe(false);
    expect(hasPermission(ROLES.FRONT_DESK, PERMISSIONS.AUDIT_READ)).toBe(false);
  });

  it('restricts CLINICIAN from billing and user administration while permitting clinical workflows', () => {
    expect(hasPermission(ROLES.CLINICIAN, PERMISSIONS.PATIENT_READ)).toBe(true);
    expect(hasPermission(ROLES.CLINICIAN, PERMISSIONS.VISIT_WRITE)).toBe(true);
    expect(hasPermission(ROLES.CLINICIAN, PERMISSIONS.CLINICAL_WRITE)).toBe(true);

    // Forbidden for CLINICIAN
    expect(hasPermission(ROLES.CLINICIAN, PERMISSIONS.INVOICE_WRITE)).toBe(false);
    expect(hasPermission(ROLES.CLINICIAN, PERMISSIONS.PAYMENT_WRITE)).toBe(false);
    expect(hasPermission(ROLES.CLINICIAN, PERMISSIONS.USER_MANAGE)).toBe(false);
  });

  it('maps legacy granular permission keys properly through aliases', () => {
    expect(hasPermission(ROLES.ADMIN, 'users:create')).toBe(true);
    expect(hasPermission(ROLES.FRONT_DESK, 'patients:create')).toBe(true);
    expect(hasPermission(ROLES.FRONT_DESK, 'users:create')).toBe(false);
  });
});


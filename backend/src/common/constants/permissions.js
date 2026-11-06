import { ROLES } from './roles.js';

const { ADMIN, FRONT_DESK, CLINICIAN } = ROLES;

/**
 * Standard Permission string identifiers.
 */
export const PERMISSIONS = Object.freeze({
  // Patients
  PATIENT_READ: 'patient:read',
  PATIENT_WRITE: 'patient:write',

  // Appointments
  APPOINTMENT_READ: 'appointment:read',
  APPOINTMENT_WRITE: 'appointment:write',

  // Encounters / Visits
  VISIT_READ: 'visit:read',
  VISIT_WRITE: 'visit:write',

  // Clinical data (prescriptions & diagnostic reports)
  CLINICAL_READ: 'clinical:read',
  CLINICAL_WRITE: 'clinical:write',

  // Financials & Billing
  INVOICE_READ: 'invoice:read',
  INVOICE_WRITE: 'invoice:write',
  PAYMENT_WRITE: 'payment:write',

  // Administrative & System
  REPORT_READ: 'report:read',
  AUDIT_READ: 'audit:read',
  USER_MANAGE: 'user:manage',
  DOCTOR_MANAGE: 'doctor:manage',
});

/**
 * Role -> Permissions mapping table.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  [ADMIN]: Object.freeze([
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.PATIENT_WRITE,
    PERMISSIONS.APPOINTMENT_READ,
    PERMISSIONS.APPOINTMENT_WRITE,
    PERMISSIONS.VISIT_READ,
    PERMISSIONS.VISIT_WRITE,
    PERMISSIONS.CLINICAL_READ,
    PERMISSIONS.CLINICAL_WRITE,
    PERMISSIONS.INVOICE_READ,
    PERMISSIONS.INVOICE_WRITE,
    PERMISSIONS.PAYMENT_WRITE,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.DOCTOR_MANAGE,
  ]),

  [FRONT_DESK]: Object.freeze([
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.PATIENT_WRITE,
    PERMISSIONS.APPOINTMENT_READ,
    PERMISSIONS.APPOINTMENT_WRITE,
    PERMISSIONS.VISIT_READ,
    PERMISSIONS.INVOICE_READ,
    PERMISSIONS.INVOICE_WRITE,
    PERMISSIONS.PAYMENT_WRITE,
  ]),

  [CLINICIAN]: Object.freeze([
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.APPOINTMENT_READ,
    PERMISSIONS.APPOINTMENT_WRITE,
    PERMISSIONS.VISIT_READ,
    PERMISSIONS.VISIT_WRITE,
    PERMISSIONS.CLINICAL_READ,
    PERMISSIONS.CLINICAL_WRITE,
  ]),
});

/**
 * Alias mapping for granular legacy permission strings.
 */
const PERMISSION_ALIASES = Object.freeze({
  'users:create': PERMISSIONS.USER_MANAGE,
  'users:read': PERMISSIONS.USER_MANAGE,
  'users:update': PERMISSIONS.USER_MANAGE,
  'users:delete': PERMISSIONS.USER_MANAGE,

  'departments:create': PERMISSIONS.DOCTOR_MANAGE,
  'departments:read': PERMISSIONS.PATIENT_READ,
  'departments:update': PERMISSIONS.DOCTOR_MANAGE,
  'departments:delete': PERMISSIONS.DOCTOR_MANAGE,

  'doctors:create': PERMISSIONS.DOCTOR_MANAGE,
  'doctors:read': PERMISSIONS.PATIENT_READ,
  'doctors:update': PERMISSIONS.DOCTOR_MANAGE,
  'doctors:delete': PERMISSIONS.DOCTOR_MANAGE,

  'schedules:create': PERMISSIONS.DOCTOR_MANAGE,
  'schedules:read': PERMISSIONS.PATIENT_READ,
  'schedules:update': PERMISSIONS.DOCTOR_MANAGE,
  'schedules:delete': PERMISSIONS.DOCTOR_MANAGE,

  'patients:create': PERMISSIONS.PATIENT_WRITE,
  'patients:read': PERMISSIONS.PATIENT_READ,
  'patients:update': PERMISSIONS.PATIENT_WRITE,
  'patients:delete': PERMISSIONS.PATIENT_WRITE,

  'appointments:create': PERMISSIONS.APPOINTMENT_WRITE,
  'appointments:read': PERMISSIONS.APPOINTMENT_READ,
  'appointments:update': PERMISSIONS.APPOINTMENT_WRITE,
  'appointments:cancel': PERMISSIONS.APPOINTMENT_WRITE,
  'appointments:checkin': PERMISSIONS.APPOINTMENT_WRITE,

  'visits:create': PERMISSIONS.VISIT_WRITE,
  'visits:read': PERMISSIONS.VISIT_READ,
  'visits:update': PERMISSIONS.VISIT_WRITE,

  'prescriptions:create': PERMISSIONS.CLINICAL_WRITE,
  'prescriptions:read': PERMISSIONS.CLINICAL_READ,
  'prescriptions:update': PERMISSIONS.CLINICAL_WRITE,
  'prescriptions:delete': PERMISSIONS.CLINICAL_WRITE,

  'diagnostic-reports:create': PERMISSIONS.CLINICAL_WRITE,
  'diagnostic-reports:read': PERMISSIONS.CLINICAL_READ,
  'diagnostic-reports:update': PERMISSIONS.CLINICAL_WRITE,

  'invoices:create': PERMISSIONS.INVOICE_WRITE,
  'invoices:read': PERMISSIONS.INVOICE_READ,
  'invoices:update': PERMISSIONS.INVOICE_WRITE,

  'payments:create': PERMISSIONS.PAYMENT_WRITE,
  'payments:read': PERMISSIONS.INVOICE_READ,

  'audit:read': PERMISSIONS.AUDIT_READ,
  'reports:read': PERMISSIONS.REPORT_READ,
});

/**
 * Check if a role possesses the specified permission key.
 * @param {string} role
 * @param {string} permissionKey
 * @returns {boolean}
 */
export function hasPermission(role, permissionKey) {
  if (!role) return false;
  const rolePerms = ROLE_PERMISSIONS[role] || [];
  if (rolePerms.includes(permissionKey)) return true;

  const resolvedAlias = PERMISSION_ALIASES[permissionKey];
  if (resolvedAlias && rolePerms.includes(resolvedAlias)) {
    return true;
  }

  return false;
}

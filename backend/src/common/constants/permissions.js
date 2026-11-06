/**
 * Permission matrix — maps each permission key to the roles that may use it.
 * authorize(permission) middleware checks req.user.role against this map.
 *
 * Convention: MODULE:ACTION
 */
import { ROLES } from './roles.js';

const { ADMIN, FRONT_DESK, CLINICIAN } = ROLES;

export const PERMISSIONS = Object.freeze({
  // ── Users ──────────────────────────────────────
  'users:create':   [ADMIN],
  'users:read':     [ADMIN],
  'users:update':   [ADMIN],
  'users:delete':   [ADMIN],

  // ── Departments ────────────────────────────────
  'departments:create': [ADMIN],
  'departments:read':   [ADMIN, FRONT_DESK, CLINICIAN],
  'departments:update': [ADMIN],
  'departments:delete': [ADMIN],

  // ── Doctors ────────────────────────────────────
  'doctors:create': [ADMIN],
  'doctors:read':   [ADMIN, FRONT_DESK, CLINICIAN],
  'doctors:update': [ADMIN],
  'doctors:delete': [ADMIN],

  // ── Schedules ──────────────────────────────────
  'schedules:create': [ADMIN],
  'schedules:read':   [ADMIN, FRONT_DESK, CLINICIAN],
  'schedules:update': [ADMIN],
  'schedules:delete': [ADMIN],

  // ── Patients ───────────────────────────────────
  'patients:create': [ADMIN, FRONT_DESK],
  'patients:read':   [ADMIN, FRONT_DESK, CLINICIAN],  // clinician scoped in service
  'patients:update': [ADMIN, FRONT_DESK],
  'patients:delete': [ADMIN, FRONT_DESK],              // soft-delete

  // ── Appointments ───────────────────────────────
  'appointments:create':  [ADMIN, FRONT_DESK],
  'appointments:read':    [ADMIN, FRONT_DESK, CLINICIAN],
  'appointments:update':  [ADMIN, FRONT_DESK],
  'appointments:cancel':  [ADMIN, FRONT_DESK],
  'appointments:checkin': [ADMIN, FRONT_DESK],

  // ── Visits (clinical encounters) ───────────────
  'visits:create': [CLINICIAN],
  'visits:read':   [ADMIN, FRONT_DESK, CLINICIAN],     // FRONT_DESK gets redacted view
  'visits:update': [CLINICIAN],

  // ── Prescriptions ─────────────────────────────
  'prescriptions:create': [CLINICIAN],
  'prescriptions:read':   [ADMIN, CLINICIAN],
  'prescriptions:update': [CLINICIAN],
  'prescriptions:delete': [CLINICIAN],

  // ── Diagnostic Reports ─────────────────────────
  'diagnostic-reports:create': [CLINICIAN],
  'diagnostic-reports:read':   [ADMIN, CLINICIAN],
  'diagnostic-reports:update': [CLINICIAN],

  // ── Billing (invoices + payments) ──────────────
  'invoices:create':  [ADMIN, FRONT_DESK],
  'invoices:read':    [ADMIN, FRONT_DESK],
  'invoices:update':  [ADMIN, FRONT_DESK],
  'payments:create':  [ADMIN, FRONT_DESK],
  'payments:read':    [ADMIN, FRONT_DESK],

  // ── Audit logs ─────────────────────────────────
  'audit:read': [ADMIN],

  // ── Reports ────────────────────────────────────
  'reports:read': [ADMIN],
});

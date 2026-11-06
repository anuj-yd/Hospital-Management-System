import * as auditRepo from './audit.repository.js';
import { getRequestContext } from '../../common/context/requestContext.js';
import { logger } from '../../config/logger.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'refreshToken',
  'accessToken',
  'clinicalNotes',
]);

/**
 * Computes difference between before and after states.
 * Sensitive attributes (passwords, tokens, clinical narrative text) are redacted or omitted.
 *
 * @param {object} oldData
 * @param {object} newData
 * @param {string[]} additionalExcludedKeys
 * @returns {object|null}
 */
export function computeChanges(oldData = {}, newData = {}, additionalExcludedKeys = []) {
  if (!oldData && !newData) return null;

  const excluded = new Set([...SENSITIVE_KEYS, ...additionalExcludedKeys]);
  const diff = {};
  const allKeys = new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {}),
  ]);

  for (const key of allKeys) {
    if (excluded.has(key)) {
      continue;
    }

    const oldVal = oldData ? oldData[key] : undefined;
    const newVal = newData ? newData[key] : undefined;

    // Serialize dates or objects for comparison
    const serializedOld = oldVal instanceof Date ? oldVal.toISOString() : oldVal;
    const serializedNew = newVal instanceof Date ? newVal.toISOString() : newVal;

    if (JSON.stringify(serializedOld) !== JSON.stringify(serializedNew)) {
      diff[key] = {
        old: serializedOld === undefined ? null : serializedOld,
        new: serializedNew === undefined ? null : serializedNew,
      };
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

/**
 * Record an audit log entry.
 * Pulls default actor and network metadata from AsyncLocalStorage if not explicitly passed.
 *
 * @param {object} params
 * @param {object} [params.tx]           Prisma interactive transaction client
 * @param {object} [params.actor]        { id, role, email }
 * @param {string} params.action         e.g. "LOGIN_SUCCESS", "CREATE", "UPDATE", "STATUS_CHANGE"
 * @param {string} params.entity         e.g. "User", "Patient", "Appointment", "Invoice"
 * @param {string} [params.entityId]     Identifier of target entity
 * @param {object} [params.changes]      Precomputed changes object
 * @param {object} [params.oldData]      Original state before update
 * @param {object} [params.newData]      Modified state after update
 * @param {object} [params.req]          Express request object (optional fallback)
 */
export async function record({
  tx,
  actor,
  action,
  entity,
  entityId,
  changes,
  oldData,
  newData,
  req,
}) {
  try {
    const ctx = getRequestContext();

    const userId = actor?.id ?? ctx.userId ?? (req?.user?.id || null);
    const userRole = actor?.role ?? ctx.role ?? (req?.user?.role || null);
    const ip = req?.ip || ctx.ip || '127.0.0.1';
    const userAgent = req?.get ? req.get('user-agent') : (ctx.userAgent || 'unknown');
    const requestId = req?.id || ctx.requestId || 'unknown';

    // Compute diff if not directly provided but old & new states are passed
    const computedDiff = changes !== undefined ? changes : computeChanges(oldData, newData);

    return await auditRepo.create(
      {
        userId,
        userRole,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        changes: computedDiff ?? null,
        ip,
        userAgent,
        requestId,
      },
      tx,
    );
  } catch (err) {
    // Fail-safe: audit failures should be logged and not bring down the main workflow
    logger.error({ err, action, entity, entityId }, 'Failed to write audit log entry');
    return null;
  }
}

/**
 * Retrieve paginated audit logs (used for reporting/administrative inspection).
 */
export async function getAuditLogs(filters) {
  return auditRepo.findAll(filters);
}

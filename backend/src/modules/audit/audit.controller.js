import * as auditService from './audit.service.js';
import { paginated } from '../../common/utils/response.js';

/**
 * GET / — list audit logs (paginated, filtered).
 */
export async function list(req, res) {
  const { data, meta } = await auditService.getAuditLogs(req.query);
  return paginated(res, data, meta);
}


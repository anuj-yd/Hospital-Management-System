import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ROLES } from '../../common/constants/roles.js';
import { listAuditLogsSchema } from './audit.schema.js';
import * as controller from './audit.controller.js';

const router = Router();

// Phase 7 Rule: GET /audit-logs is ADMIN only. Read-only; no update or delete endpoints exist.
router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(listAuditLogsSchema, 'query'),
  asyncHandler(controller.list),
);

export default router;

import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { listAuditLogsSchema } from './audit.schema.js';
import * as controller from './audit.controller.js';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize('audit:read'),
  validate(listAuditLogsSchema, 'query'),
  asyncHandler(controller.list),
);

export default router;


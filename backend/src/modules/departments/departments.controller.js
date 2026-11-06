import * as departmentService from './departments.service.js';
import { success, created, noContent, paginated } from '../../common/utils/response.js';

/**
 * Extract audit context from the request.
 */
function auditCtx(req) {
  return {
    userId: req.user.id,
    role: req.user.role,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
  };
}

/**
 * POST / — create a department.
 */
export async function create(req, res) {
  const department = await departmentService.createDepartment(req.body, auditCtx(req));
  return created(res, department);
}

/**
 * GET /:id — get a department by ID.
 */
export async function getById(req, res) {
  const department = await departmentService.getDepartmentById(req.params.id);
  return success(res, department);
}

/**
 * GET / — list departments (paginated).
 */
export async function list(req, res) {
  const { data, meta } = await departmentService.getDepartments(req.query);
  return paginated(res, data, meta);
}

/**
 * PATCH /:id — update a department.
 */
export async function update(req, res) {
  const department = await departmentService.updateDepartment(req.params.id, req.body, auditCtx(req));
  return success(res, department);
}

/**
 * DELETE /:id — soft delete a department.
 */
export async function remove(req, res) {
  await departmentService.deleteDepartment(req.params.id, auditCtx(req));
  return noContent(res);
}

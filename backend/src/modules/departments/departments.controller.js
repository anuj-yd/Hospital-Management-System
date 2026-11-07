import * as departmentService from './departments.service.js';
import { success, created, paginated } from '../../common/utils/response.js';

function auditCtx(req) {
  return {
    id: req.user.id,
    role: req.user.role,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? null,
    requestId: req.id ?? null,
  };
}

/**
 * POST /departments — create a department (ADMIN).
 */
export async function create(req, res) {
  const department = await departmentService.createDepartment(req.body, auditCtx(req));
  return created(res, department);
}

/**
 * GET /departments/:id — get a department by ID (all authenticated roles).
 */
export async function getById(req, res) {
  const department = await departmentService.getDepartmentById(req.params.id);
  return success(res, department);
}

/**
 * GET /departments — list departments (all authenticated roles).
 */
export async function list(req, res) {
  const { data, meta } = await departmentService.getDepartments(req.query);
  return paginated(res, data, meta);
}

/**
 * PATCH /departments/:id — update a department (ADMIN).
 */
export async function update(req, res) {
  const department = await departmentService.updateDepartment(req.params.id, req.body, auditCtx(req));
  return success(res, department);
}

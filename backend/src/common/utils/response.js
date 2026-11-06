/**
 * Standardized JSON response helpers.
 */

/**
 * 200 OK success response.
 * @param {import('express').Response} res
 * @param {any} data
 * @param {number} statusCode
 */
export function ok(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

// Backward-compatible alias
export const success = ok;

/**
 * 201 Created response.
 * @param {import('express').Response} res
 * @param {any} data
 */
export function created(res, data) {
  return ok(res, data, 201);
}

/**
 * 200 OK Paginated response with metadata.
 * @param {import('express').Response} res
 * @param {any[]} data
 * @param {object} meta
 */
export function paginated(res, data, meta) {
  return res.status(200).json({
    success: true,
    data,
    meta,
  });
}

/**
 * 204 No Content response.
 * @param {import('express').Response} res
 */
export function noContent(res) {
  return res.status(204).send();
}

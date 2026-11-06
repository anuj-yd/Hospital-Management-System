/**
 * Consistent JSON response helpers.
 */

/**
 * Success response (single resource or action result).
 */
export function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Success response with pagination meta.
 */
export function paginated(res, data, meta) {
  return res.status(200).json({
    success: true,
    data,
    meta,
  });
}

/**
 * 201 Created response.
 */
export function created(res, data) {
  return success(res, data, 201);
}

/**
 * 204 No Content response.
 */
export function noContent(res) {
  return res.status(204).send();
}

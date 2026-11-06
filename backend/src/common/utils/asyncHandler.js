/**
 * Wraps an async route handler so thrown errors reach the error handler middleware.
 * Eliminates try/catch boilerplate in every controller.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

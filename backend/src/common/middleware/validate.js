import { ValidationError } from '../errors/index.js';

/**
 * Validation middleware factory.
 * Validates req.body (default), req.query, or req.params against a Zod schema.
 *
 * Usage:
 *   validate(createPatientSchema)              // validates body
 *   validate(listQuerySchema, 'query')         // validates query
 *   validate(idParamSchema, 'params')          // validates params
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new ValidationError('Validation failed', details);
    }
    // Replace with parsed & coerced values
    req[source] = result.data;
    next();
  };
}

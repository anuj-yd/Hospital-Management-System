import { ValidationError } from '../errors/index.js';

/**
 * Universal validation middleware factory.
 * Supports:
 *   1. Single Zod schema: validate(myBodySchema, 'body')
 *   2. Composite schemas: validate({ body: schemaA, query: schemaB, params: schemaC })
 */
export function validate(schemaOrComposite, defaultSource = 'body') {
  return (req, _res, next) => {
    // If composite object with body/query/params keys
    if (
      schemaOrComposite &&
      typeof schemaOrComposite === 'object' &&
      !('safeParse' in schemaOrComposite) &&
      (schemaOrComposite.body || schemaOrComposite.query || schemaOrComposite.params)
    ) {
      const sources = ['body', 'query', 'params'];
      const allDetails = [];

      for (const src of sources) {
        if (schemaOrComposite[src]) {
          const result = schemaOrComposite[src].safeParse(req[src]);
          if (!result.success) {
            allDetails.push(
              ...result.error.issues.map((issue) => ({
                source: src,
                field: issue.path.join('.'),
                message: issue.message,
                code: issue.code,
              })),
            );
          } else {
            req[src] = result.data;
          }
        }
      }

      if (allDetails.length > 0) {
        throw new ValidationError('Validation failed', allDetails);
      }

      return next();
    }

    // Single Zod schema
    const result = schemaOrComposite.safeParse(req[defaultSource]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        source: defaultSource,
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));
      throw new ValidationError('Validation failed', details);
    }

    req[defaultSource] = result.data;
    next();
  };
}

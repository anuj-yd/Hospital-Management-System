/**
 * Base application error. All custom errors extend this.
 * Never expose stack traces to clients in production.
 */
export class AppError extends Error {
  /**
   * @param {string} code    Machine-readable error code (e.g. "VALIDATION_ERROR")
   * @param {string} message Human-readable message
   * @param {number} status  HTTP status code
   * @param {any[]}  details Optional array of validation details
   */
  constructor(code, message, status = 500, details = []) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = []) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHENTICATED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(entity = 'Resource', id) {
    const msg = id ? `${entity} with id '${id}' not found` : `${entity} not found`;
    super('NOT_FOUND', msg, 404);
  }
}

export class ConflictError extends AppError {
  constructor(code = 'CONFLICT', message = 'Resource conflict') {
    super(code, message, 409);
  }
}

export class SlotTakenError extends AppError {
  constructor(message = 'This time slot is already booked') {
    super('SLOT_TAKEN', message, 409);
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(entity, from, to) {
    super(
      'INVALID_STATE_TRANSITION',
      `Cannot transition ${entity} from '${from}' to '${to}'`,
      409,
    );
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(message = 'A request with this idempotency key has already been processed') {
    super('IDEMPOTENCY_CONFLICT', message, 409);
  }
}

export class BusinessRuleViolationError extends AppError {
  constructor(message = 'Business rule violation') {
    super('BUSINESS_RULE_VIOLATION', message, 422);
  }
}

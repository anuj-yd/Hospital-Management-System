/**
 * Base application error. All custom domain errors extend this.
 * Prevents internal stack traces from leaking to clients in production.
 */
export class AppError extends Error {
  /**
   * @param {string} code       Machine-readable error code (e.g. "VALIDATION_ERROR")
   * @param {string} message    Human-readable error description
   * @param {number} statusCode HTTP status code (e.g. 400, 401, 403, 404, 409, 422, 500)
   * @param {any[]}  details    Optional array of error/validation details
   */
  constructor(code, message, statusCode = 500, details = []) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.status = statusCode;
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
  constructor(message = 'Resource conflict', code = 'CONFLICT') {
    super(code, message, 409);
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(entity = 'Resource', from = 'unknown', to = 'unknown', customMessage) {
    const message = customMessage || `Cannot transition ${entity} from '${from}' to '${to}'`;
    super('INVALID_STATE_TRANSITION', message, 409);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message = 'Business rule violation', details = []) {
    super('BUSINESS_RULE_VIOLATION', message, 422, details);
  }
}

// Backward-compatible alias
export const BusinessRuleViolationError = BusinessRuleError;

export class IdempotencyConflictError extends AppError {
  constructor(message = 'A request with this idempotency key has already been processed with different payload') {
    super('IDEMPOTENCY_CONFLICT', message, 409);
  }
}

export class SlotTakenError extends AppError {
  constructor(message = 'This appointment time slot is already booked for this doctor') {
    super('SLOT_TAKEN', message, 409);
  }
}

export class PatientDoubleBookedError extends AppError {
  constructor(message = 'Patient already has an active appointment at this time', details = []) {
    super('PATIENT_DOUBLE_BOOKED', message, 422, details);
  }
}


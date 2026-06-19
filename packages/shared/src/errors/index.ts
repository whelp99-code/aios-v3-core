/**
 * Domain Error Types
 */

/** Base application error */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Service not configured */
export class NotConfiguredError extends AppError {
  constructor(service: string) {
    super(`${service} is not configured`, 'NOT_CONFIGURED', 503);
    this.name = 'NotConfiguredError';
  }
}

/** Service degraded */
export class DegradedError extends AppError {
  constructor(service: string, reason: string) {
    super(`${service} is degraded: ${reason}`, 'DEGRADED', 503);
    this.name = 'DegradedError';
  }
}

/** Validation error */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

/** Not found */
export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

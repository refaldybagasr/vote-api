export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Repository-layer signal, not HTTP-aware — services translate this into the
 * appropriate AppError (e.g. USERNAME_TAKEN, CANDIDATE conflicts) for their domain.
 */
export class DuplicateKeyError extends Error {
  readonly field: string;

  constructor(field: string) {
    super(`Duplicate value for field "${field}"`);
    this.name = 'DuplicateKeyError';
    this.field = field;
  }
}

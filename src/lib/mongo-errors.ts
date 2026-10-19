import { DuplicateKeyError } from './errors';

interface MongoDuplicateKeyErrorLike {
  code: 11000;
  keyPattern?: Record<string, unknown>;
}

export function isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyErrorLike {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

export function toDuplicateKeyError(err: unknown): DuplicateKeyError {
  if (!isDuplicateKeyError(err)) {
    throw new Error('Not a MongoDB duplicate-key error');
  }

  const field = err.keyPattern ? Object.keys(err.keyPattern)[0] : undefined;
  return new DuplicateKeyError(field ?? 'unknown');
}

import bcrypt from 'bcrypt';

const MAX_PASSWORD_BYTES = 72;

export class PasswordTooLongError extends Error {
  constructor() {
    super(`Password must be at most ${MAX_PASSWORD_BYTES} bytes`);
    this.name = 'PasswordTooLongError';
  }
}

export async function hashPassword(password: string, cost: number): Promise<string> {
  assertPasswordLength(password);
  return bcrypt.hash(password, cost);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  assertPasswordLength(password);
  return bcrypt.compare(password, hash);
}

function assertPasswordLength(password: string): void {
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new PasswordTooLongError();
  }
}

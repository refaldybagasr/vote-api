import crypto from 'crypto';

const RAW_TOKEN_BYTES = 32;

export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(RAW_TOKEN_BYTES).toString('base64url');
  return { raw, hash: hashRefreshToken(raw) };
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

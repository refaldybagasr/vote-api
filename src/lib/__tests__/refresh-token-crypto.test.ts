import { generateRefreshToken, hashRefreshToken } from '../refresh-token-crypto';

describe('refresh token crypto', () => {
  it('generates a raw token with at least 32 bytes of entropy (base64url)', () => {
    const { raw } = generateRefreshToken();

    expect(Buffer.from(raw, 'base64url').length).toBeGreaterThanOrEqual(32);
  });

  it('generates a different raw token every time', () => {
    expect(generateRefreshToken().raw).not.toBe(generateRefreshToken().raw);
  });

  it('hashes consistently, so the same raw token always maps to the same hash', () => {
    const { raw, hash } = generateRefreshToken();

    expect(hashRefreshToken(raw)).toBe(hash);
  });

  it('produces a sha256 hex digest (64 lowercase hex characters)', () => {
    const { hash } = generateRefreshToken();

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

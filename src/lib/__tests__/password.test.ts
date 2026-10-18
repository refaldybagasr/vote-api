import { hashPassword, verifyPassword, PasswordTooLongError } from '../password';

const COST = 4;

describe('password helper', () => {
  it('hashes a password and verifies the correct password against it', async () => {
    const hash = await hashPassword('correct-password', COST);

    await expect(verifyPassword('correct-password', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password against the hash', async () => {
    const hash = await hashPassword('correct-password', COST);

    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('rejects passwords longer than 72 bytes when hashing', async () => {
    await expect(hashPassword('a'.repeat(73), COST)).rejects.toThrow(PasswordTooLongError);
  });

  it('rejects passwords longer than 72 bytes (multi-byte characters) when hashing', async () => {
    const emojiPassword = '🎉'.repeat(19); // 19 chars, 76 UTF-8 bytes
    expect(Buffer.byteLength(emojiPassword, 'utf8')).toBeGreaterThan(72);

    await expect(hashPassword(emojiPassword, COST)).rejects.toThrow(PasswordTooLongError);
  });

  it('rejects passwords longer than 72 bytes when verifying', async () => {
    const hash = await hashPassword('short-password', COST);

    await expect(verifyPassword('a'.repeat(73), hash)).rejects.toThrow(PasswordTooLongError);
  });

  it('accepts a password exactly at the 72-byte limit', async () => {
    const password = 'a'.repeat(72);
    const hash = await hashPassword(password, COST);

    await expect(verifyPassword(password, hash)).resolves.toBe(true);
  });
});

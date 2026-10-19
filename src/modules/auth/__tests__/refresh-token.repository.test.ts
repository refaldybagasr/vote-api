import mongoose from 'mongoose';
import { RefreshTokenModel } from '../refresh-token.model';
import { RefreshTokenMongoRepository } from '../refresh-token.repository';

describe('RefreshTokenMongoRepository', () => {
  const repository = new RefreshTokenMongoRepository();
  const userId = new mongoose.Types.ObjectId().toString();

  it('stores only the hash, never anything resembling a raw token field', async () => {
    await repository.create({
      userId,
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 1000 * 60),
    });

    const doc = await RefreshTokenModel.findOne({ tokenHash: 'a'.repeat(64) }).lean();
    expect(doc).toMatchObject({ tokenHash: 'a'.repeat(64), userId: expect.anything() });
    expect(JSON.stringify(doc)).not.toMatch(/rawToken|plaintext/i);
  });

  it('rotates (revokes) an active token exactly once', async () => {
    const tokenHash = 'b'.repeat(64);
    const now = new Date();
    await repository.create({ userId, tokenHash, expiresAt: new Date(now.getTime() + 60_000) });

    const first = await repository.rotateByHash(tokenHash, now);
    const second = await repository.rotateByHash(tokenHash, now);

    expect(first).toMatchObject({ userId });
    expect(second).toBeNull();
  });

  it('exactly one of 10 concurrent rotation attempts on the same token succeeds', async () => {
    const tokenHash = 'c'.repeat(64);
    const now = new Date();
    await repository.create({ userId, tokenHash, expiresAt: new Date(now.getTime() + 60_000) });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => repository.rotateByHash(tokenHash, now)),
    );

    expect(results.filter((result) => result !== null)).toHaveLength(1);
  });

  it('does not rotate an already-expired token, even if still present in the database', async () => {
    const tokenHash = 'd'.repeat(64);
    const past = new Date(Date.now() - 1000);
    await repository.create({ userId, tokenHash, expiresAt: past });

    expect(await repository.rotateByHash(tokenHash, new Date())).toBeNull();
  });

  it('does not rotate an unknown token', async () => {
    expect(await repository.rotateByHash('e'.repeat(64), new Date())).toBeNull();
  });

  it('revokes every active token for a user', async () => {
    const otherUserId = new mongoose.Types.ObjectId().toString();
    const now = new Date();
    await repository.create({ userId: otherUserId, tokenHash: 'f'.repeat(64), expiresAt: new Date(now.getTime() + 60_000) });
    await repository.create({ userId: otherUserId, tokenHash: 'g'.repeat(64), expiresAt: new Date(now.getTime() + 60_000) });

    await repository.revokeAllForUser(otherUserId);

    expect(await repository.rotateByHash('f'.repeat(64), now)).toBeNull();
    expect(await repository.rotateByHash('g'.repeat(64), now)).toBeNull();
  });

  it('findByHash finds a token regardless of revoked/expired state', async () => {
    const tokenHash = 'h'.repeat(64);
    const past = new Date(Date.now() - 1000);
    await repository.create({ userId, tokenHash, expiresAt: past });

    const found = await repository.findByHash(tokenHash);

    expect(found).toMatchObject({ userId });
  });

  it('findByHash returns null for an unknown hash', async () => {
    expect(await repository.findByHash('i'.repeat(64))).toBeNull();
  });
});

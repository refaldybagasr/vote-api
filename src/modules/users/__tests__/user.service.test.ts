import { AppError } from '../../../lib/errors';
import { FakeTransactionManager } from '../../shared/fake-transaction-manager';
import { FakeRefreshTokenRepository } from '../../auth/fake-refresh-token-repository';
import { FakeUserRepository } from '../fake-user-repository';
import { UserService } from '../user.service';

function build() {
  const userRepository = new FakeUserRepository();
  const refreshTokenRepository = new FakeRefreshTokenRepository();
  const service = new UserService({
    userRepository,
    refreshTokenRepository,
    transactionManager: new FakeTransactionManager(),
    bcryptCost: 4,
  });
  return { service, userRepository, refreshTokenRepository };
}

describe('UserService.create', () => {
  it('creates a user and hashes the password', async () => {
    const { service } = build();

    const user = await service.create({ username: 'newuser', password: 'password123', role: 'user' });

    expect(user).toMatchObject({ username: 'newuser', role: 'user' });
    expect((user as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
  });

  it('rejects a duplicate username with USERNAME_TAKEN', async () => {
    const { service } = build();
    await service.create({ username: 'dupe', password: 'password123', role: 'user' });

    await expect(
      service.create({ username: 'dupe', password: 'password123', role: 'user' }),
    ).rejects.toMatchObject({ code: 'USERNAME_TAKEN', statusCode: 409 });
  });

  it('rejects a password over the 72-byte bcrypt limit with VALIDATION_ERROR, not a 500', async () => {
    const { service } = build();

    await expect(
      service.create({ username: 'longpw', password: 'a'.repeat(100), role: 'user' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  });
});

describe('UserService.update (last-admin protection, without a database)', () => {
  it('blocks demoting the last active admin', async () => {
    const { service } = build();
    const admin = await service.create({ username: 'onlyadmin', password: 'password123', role: 'admin' });

    await expect(
      service.update(admin.id, 0, { role: 'user' }, 'some-other-user-id'),
    ).rejects.toMatchObject({ code: 'LAST_ADMIN', statusCode: 400 });
  });

  it('blocks disabling the last active admin', async () => {
    const { service } = build();
    const admin = await service.create({ username: 'onlyadmin2', password: 'password123', role: 'admin' });

    await expect(
      service.update(admin.id, 0, { isActive: false }, 'some-other-user-id'),
    ).rejects.toMatchObject({ code: 'LAST_ADMIN' });
  });

  it('allows demoting an admin when another active admin still exists', async () => {
    const { service } = build();
    const admin1 = await service.create({ username: 'admin1', password: 'password123', role: 'admin' });
    await service.create({ username: 'admin2', password: 'password123', role: 'admin' });

    const result = await service.update(admin1.id, 0, { role: 'user' }, 'requester-id');

    expect(result.role).toBe('user');
  });

  it('blocks an admin from disabling themselves', async () => {
    const { service } = build();
    const admin = await service.create({ username: 'self', password: 'password123', role: 'admin' });
    await service.create({ username: 'otheradmin', password: 'password123', role: 'admin' });

    await expect(service.update(admin.id, 0, { isActive: false }, admin.id)).rejects.toMatchObject({
      code: 'CANNOT_MODIFY_SELF',
      statusCode: 400,
    });
  });

  it('blocks an admin from demoting themselves', async () => {
    const { service } = build();
    const admin = await service.create({ username: 'self2', password: 'password123', role: 'admin' });
    await service.create({ username: 'otheradmin2', password: 'password123', role: 'admin' });

    await expect(service.update(admin.id, 0, { role: 'user' }, admin.id)).rejects.toMatchObject({
      code: 'CANNOT_MODIFY_SELF',
    });
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const { service } = build();

    await expect(service.update('does-not-exist', 0, { isActive: false }, 'requester-id')).rejects.toMatchObject(
      { code: 'NOT_FOUND', statusCode: 404 },
    );
  });

  it('returns 409 STALE_UPDATE when the version does not match', async () => {
    const { service } = build();
    const user = await service.create({ username: 'staleuser', password: 'password123', role: 'user' });

    await expect(service.update(user.id, 999, { isActive: false }, 'requester-id')).rejects.toMatchObject({
      code: 'STALE_UPDATE',
      statusCode: 409,
    });
  });

  it('revokes refresh tokens after a successful update', async () => {
    const { service, refreshTokenRepository } = build();
    const user = await service.create({ username: 'tokenholder', password: 'password123', role: 'user' });
    await refreshTokenRepository.create({ userId: user.id, tokenHash: 'abc', expiresAt: new Date(Date.now() + 60_000) });

    await service.update(user.id, 0, { isActive: false }, 'requester-id');

    expect(await refreshTokenRepository.rotateByHash('abc', new Date())).toBeNull();
  });
});

describe('UserService.softDelete', () => {
  it('blocks deleting the last active admin', async () => {
    const { service } = build();
    const admin = await service.create({ username: 'lastadmin', password: 'password123', role: 'admin' });

    await expect(service.softDelete(admin.id, 'requester-id')).rejects.toMatchObject({ code: 'LAST_ADMIN' });
  });

  it('blocks an admin from deleting themselves', async () => {
    const { service } = build();
    const admin = await service.create({ username: 'selfdelete', password: 'password123', role: 'admin' });
    await service.create({ username: 'otheradmin3', password: 'password123', role: 'admin' });

    await expect(service.softDelete(admin.id, admin.id)).rejects.toMatchObject({
      code: 'CANNOT_MODIFY_SELF',
    });
  });

  it('deletes a regular user and revokes their refresh tokens', async () => {
    const { service, userRepository } = build();
    const user = await service.create({ username: 'deleteregular', password: 'password123', role: 'user' });

    await service.softDelete(user.id, 'requester-id');

    expect((await userRepository.findById(user.id))?.deletedAt).not.toBeNull();
  });

  it('returns 404 for an unknown id', async () => {
    const { service } = build();

    await expect(service.softDelete('does-not-exist', 'requester-id')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('UserService.list', () => {
  it('maps hasVoted from the injected lookup', async () => {
    const userRepository = new FakeUserRepository();
    const service = new UserService({
      userRepository,
      refreshTokenRepository: new FakeRefreshTokenRepository(),
      transactionManager: new FakeTransactionManager(),
      bcryptCost: 4,
      hasVotedLookup: async (ids) => new Set(ids.slice(0, 1)),
    });
    const a = await service.create({ username: 'voter', password: 'password123', role: 'user' });
    const b = await service.create({ username: 'nonvoter', password: 'password123', role: 'user' });

    const { items } = await service.list({ page: 1, limit: 20 });

    const voterItem = items.find((item) => item.id === a.id);
    const nonVoterItem = items.find((item) => item.id === b.id);
    expect([voterItem?.hasVoted, nonVoterItem?.hasVoted]).toContain(true);
  });

  it('defaults hasVoted to false when no lookup is injected', async () => {
    const { service } = build();
    await service.create({ username: 'plainuser', password: 'password123', role: 'user' });

    const { items } = await service.list({ page: 1, limit: 20 });

    expect(items.every((item) => item.hasVoted === false)).toBe(true);
  });
});

describe('error instance check', () => {
  it('every thrown error is an AppError', async () => {
    const { service } = build();
    try {
      await service.update('does-not-exist', 0, { isActive: false }, 'x');
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
    }
  });
});

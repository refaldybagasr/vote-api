import { AppError } from '../../../lib/errors';
import { ManualClock } from '../../../lib/clock';
import { hashPassword } from '../../../lib/password';
import { FakeTransactionManager } from '../../shared/fake-transaction-manager';
import { FakeUserRepository } from '../../users/fake-user-repository';
import type { UserRecord } from '../../users/user.repository';
import { FakeRefreshTokenRepository } from '../fake-refresh-token-repository';
import { AuthService } from '../auth.service';

const JWT_CONFIG_BASE = { secret: 'a-sufficiently-long-test-secret', issuer: 'vote-api', audience: 'vote-web' };

async function buildService(users: UserRecord[], clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'))) {
  const dummyPasswordHash = await hashPassword('dummy-password-for-timing-safety', 4);
  const userRepository = new FakeUserRepository(users);
  const refreshTokenRepository = new FakeRefreshTokenRepository();
  const service = new AuthService({
    userRepository,
    refreshTokenRepository,
    transactionManager: new FakeTransactionManager(),
    jwtConfig: { ...JWT_CONFIG_BASE, clock },
    accessTokenTtlSeconds: 900,
    refreshTokenTtlDays: 7,
    dummyPasswordHash,
  });
  return { service, clock, userRepository, refreshTokenRepository };
}

async function makeUser(overrides: Partial<UserRecord> = {}): Promise<UserRecord> {
  return {
    id: '507f1f77bcf86cd799439011',
    username: 'admin',
    passwordHash: await hashPassword('correct-password', 4),
    role: 'user',
    isActive: true,
    deletedAt: null,
    tokenVersion: 0,
    ...overrides,
  };
}

describe('AuthService.login', () => {
  it('returns an access token, a refresh token and the public user on success', async () => {
    const user = await makeUser();
    const { service } = await buildService([user]);

    const result = await service.login('admin', 'correct-password');

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user).toEqual({ id: user.id, username: user.username, role: user.role });
  });

  it('rejects an unknown username with INVALID_CREDENTIALS', async () => {
    const { service } = await buildService([]);

    await expect(service.login('nobody', 'whatever')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    });
  });

  it('rejects the wrong password with INVALID_CREDENTIALS', async () => {
    const user = await makeUser();
    const { service } = await buildService([user]);

    await expect(service.login('admin', 'wrong-password')).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a disabled user with INVALID_CREDENTIALS', async () => {
    const user = await makeUser({ isActive: false });
    const { service } = await buildService([user]);

    await expect(service.login('admin', 'correct-password')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects a soft-deleted user with INVALID_CREDENTIALS', async () => {
    const user = await makeUser({ deletedAt: new Date() });
    const { service } = await buildService([user]);

    await expect(service.login('admin', 'correct-password')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects a password over the 72-byte bcrypt limit with INVALID_CREDENTIALS, not a 500', async () => {
    const user = await makeUser();
    const { service } = await buildService([user]);

    await expect(service.login('admin', 'a'.repeat(100))).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });
});

describe('AuthService.refresh', () => {
  it('rotates the token and returns a new access + refresh token', async () => {
    const user = await makeUser();
    const { service } = await buildService([user]);
    const { refreshToken } = await service.login('admin', 'correct-password');

    const result = await service.refresh(refreshToken);

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.refreshToken).not.toBe(refreshToken);
  });

  it('rejects reusing the same token after it has been rotated', async () => {
    const user = await makeUser();
    const { service } = await buildService([user]);
    const { refreshToken } = await service.login('admin', 'correct-password');
    await service.refresh(refreshToken);

    await expect(service.refresh(refreshToken)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects an unknown token', async () => {
    const { service } = await buildService([]);

    await expect(service.refresh('not-a-real-token')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a token belonging to a now-disabled user', async () => {
    const user = await makeUser();
    const { service } = await buildService([user]);
    const { refreshToken } = await service.login('admin', 'correct-password');

    user.isActive = false;

    await expect(service.refresh(refreshToken)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('AuthService.logout', () => {
  it('is a no-op (does not throw) when no token is given', async () => {
    const { service } = await buildService([]);

    await expect(service.logout(undefined)).resolves.toBeUndefined();
  });

  it('is a no-op (does not throw) for an unrecognized token', async () => {
    const { service } = await buildService([]);

    await expect(service.logout('not-a-real-token')).resolves.toBeUndefined();
  });

  it('revokes the token and bumps the tokenVersion so the old access token becomes invalid', async () => {
    const user = await makeUser();
    const { service, userRepository } = await buildService([user]);
    const { refreshToken } = await service.login('admin', 'correct-password');

    await service.logout(refreshToken);

    await expect(service.refresh(refreshToken)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect((await userRepository.findById(user.id))?.tokenVersion).toBe(1);
  });
});

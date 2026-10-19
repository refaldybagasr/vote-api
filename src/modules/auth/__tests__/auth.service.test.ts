import { AppError } from '../../../lib/errors';
import { ManualClock } from '../../../lib/clock';
import { hashPassword } from '../../../lib/password';
import { FakeUserRepository } from '../../users/fake-user-repository';
import type { UserRecord } from '../../users/user.repository';
import { AuthService } from '../auth.service';

const JWT_CONFIG_BASE = { secret: 'a-sufficiently-long-test-secret', issuer: 'vote-api', audience: 'vote-web' };

async function buildService(users: UserRecord[], clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'))) {
  const dummyPasswordHash = await hashPassword('dummy-password-for-timing-safety', 4);
  const service = new AuthService({
    userRepository: new FakeUserRepository(users),
    jwtConfig: { ...JWT_CONFIG_BASE, clock },
    accessTokenTtlSeconds: 900,
    dummyPasswordHash,
  });
  return { service, clock };
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
  it('returns an access token and the public user on success', async () => {
    const user = await makeUser();
    const { service } = await buildService([user]);

    const result = await service.login('admin', 'correct-password');

    expect(result.accessToken).toBeTruthy();
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

describe('AuthService.getById', () => {
  it('returns the public user for a valid, active user', async () => {
    const user = await makeUser();
    const { service } = await buildService([user]);

    await expect(service.getById(user.id)).resolves.toEqual({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  });

  it('rejects an unknown id', async () => {
    const { service } = await buildService([]);

    await expect(service.getById('does-not-exist')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a soft-deleted user', async () => {
    const user = await makeUser({ deletedAt: new Date() });
    const { service } = await buildService([user]);

    await expect(service.getById(user.id)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

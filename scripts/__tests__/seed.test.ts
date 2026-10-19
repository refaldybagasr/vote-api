import { verifyPassword } from '../../src/lib/password';
import { UserMongoRepository } from '../../src/modules/users/user.repository';
import { UserModel } from '../../src/modules/users/user.model';
import { parseDemoUsers, seedUsers } from '../seed';

const BCRYPT_COST = 4;

function baseConfig(overrides: Partial<Parameters<typeof seedUsers>[1]> = {}) {
  return {
    SEED_ADMIN_USERNAME: 'admin',
    SEED_ADMIN_PASSWORD: 'dev-only-admin-password',
    SEED_DEMO_USERS: '',
    BCRYPT_COST,
    ...overrides,
  };
}

describe('parseDemoUsers', () => {
  it('parses comma-separated username:password pairs', () => {
    expect(parseDemoUsers('demo1:pass1,demo2:pass2')).toEqual([
      { username: 'demo1', password: 'pass1' },
      { username: 'demo2', password: 'pass2' },
    ]);
  });

  it('trims whitespace and ignores empty segments', () => {
    expect(parseDemoUsers(' demo1 : pass1 , , demo2:pass2 ')).toEqual([
      { username: 'demo1', password: 'pass1' },
      { username: 'demo2', password: 'pass2' },
    ]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseDemoUsers('')).toEqual([]);
  });

  it('skips entries missing a username or password', () => {
    expect(parseDemoUsers('demo1:,:,onlyusername')).toEqual([]);
  });

  it('keeps colons that are part of the password', () => {
    expect(parseDemoUsers('demo1:pass:with:colons')).toEqual([
      { username: 'demo1', password: 'pass:with:colons' },
    ]);
  });
});

describe('seedUsers', () => {
  it('creates the admin user from config when none exists', async () => {
    const userRepository = new UserMongoRepository();

    const result = await seedUsers(userRepository, baseConfig());

    expect(result.adminCreated).toBe(true);
    const admin = await UserModel.findOne({ username: 'admin' });
    expect(admin).not.toBeNull();
    expect(admin!.role).toBe('admin');
    expect(await verifyPassword('dev-only-admin-password', admin!.passwordHash)).toBe(true);
    expect(await UserModel.countDocuments({ role: 'admin' })).toBe(1);
  });

  it('running it twice keeps exactly one admin and does not reset the password', async () => {
    const userRepository = new UserMongoRepository();

    await seedUsers(userRepository, baseConfig());
    const second = await seedUsers(userRepository, baseConfig({ SEED_ADMIN_PASSWORD: 'a-different-password' }));

    expect(second.adminCreated).toBe(false);
    expect(await UserModel.countDocuments({ role: 'admin' })).toBe(1);
    const admin = await UserModel.findOne({ username: 'admin' });
    expect(await verifyPassword('dev-only-admin-password', admin!.passwordHash)).toBe(true);
    expect(await verifyPassword('a-different-password', admin!.passwordHash)).toBe(false);
  });

  it('creates demo users from SEED_DEMO_USERS', async () => {
    const userRepository = new UserMongoRepository();

    const result = await seedUsers(
      userRepository,
      baseConfig({ SEED_DEMO_USERS: 'demo1:dev-only-password,demo2:dev-only-password' }),
    );

    expect(result.demoUsersCreated).toEqual(['demo1', 'demo2']);
    expect(await UserModel.countDocuments({ role: 'user' })).toBe(2);
  });

  it('is idempotent for demo users too', async () => {
    const userRepository = new UserMongoRepository();
    const config = baseConfig({ SEED_DEMO_USERS: 'demo1:dev-only-password' });

    await seedUsers(userRepository, config);
    const second = await seedUsers(userRepository, config);

    expect(second.demoUsersCreated).toEqual([]);
    expect(second.demoUsersSkipped).toEqual(['demo1']);
    expect(await UserModel.countDocuments({ role: 'user' })).toBe(1);
  });

  it('creates no demo users when SEED_DEMO_USERS is empty', async () => {
    const userRepository = new UserMongoRepository();

    const result = await seedUsers(userRepository, baseConfig());

    expect(result.demoUsersCreated).toEqual([]);
    expect(result.demoUsersSkipped).toEqual([]);
  });
});

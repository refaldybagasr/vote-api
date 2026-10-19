import mongoose from 'mongoose';
import { UserModel } from '../user.model';
import { UserMongoRepository } from '../user.repository';

describe('UserMongoRepository', () => {
  const repository = new UserMongoRepository();

  it('finds a user by username', async () => {
    await UserModel.create({
      username: 'admin',
      passwordHash: 'hash',
      role: 'admin',
      isActive: true,
      tokenVersion: 0,
    });

    const found = await repository.findByUsername('admin');

    expect(found).toMatchObject({ username: 'admin', role: 'admin' });
  });

  it('returns null when no user matches the username', async () => {
    expect(await repository.findByUsername('nobody')).toBeNull();
  });

  it('finds a user by id', async () => {
    const created = await UserModel.create({
      username: 'byid',
      passwordHash: 'hash',
      role: 'user',
      isActive: true,
      tokenVersion: 0,
    });

    const found = await repository.findById(created._id.toString());

    expect(found).toMatchObject({ id: created._id.toString(), username: 'byid' });
  });

  it('returns null for a syntactically invalid id', async () => {
    expect(await repository.findById('not-an-object-id')).toBeNull();
  });

  it('returns null for a well-formed id that does not exist', async () => {
    expect(await repository.findById(new mongoose.Types.ObjectId().toString())).toBeNull();
  });

  it('stores the username in lowercase regardless of input casing', async () => {
    await UserModel.create({
      username: 'MixedCase',
      passwordHash: 'hash',
      role: 'user',
      isActive: true,
      tokenVersion: 0,
    });

    expect(await repository.findByUsername('mixedcase')).not.toBeNull();
  });

  it('rejects a duplicate username', async () => {
    await UserModel.create({
      username: 'dupe',
      passwordHash: 'hash',
      role: 'user',
      isActive: true,
      tokenVersion: 0,
    });

    await expect(
      UserModel.create({
        username: 'dupe',
        passwordHash: 'hash2',
        role: 'user',
        isActive: true,
        tokenVersion: 0,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('increments the tokenVersion', async () => {
    const created = await UserModel.create({
      username: 'incrementme',
      passwordHash: 'hash',
      role: 'user',
      isActive: true,
      tokenVersion: 0,
    });

    await repository.incrementTokenVersion(created._id.toString());

    const found = await repository.findById(created._id.toString());
    expect(found?.tokenVersion).toBe(1);
  });

  it('creates a user and returns the record without a passwordHash leaking into callers by surprise', async () => {
    const created = await repository.create({ username: 'created', passwordHash: 'hash', role: 'user' });

    expect(created).toMatchObject({ username: 'created', role: 'user', isActive: true, version: 0 });
    expect(created.createdAt).toBeInstanceOf(Date);
  });

  it('lists users excluding soft-deleted ones, paginated', async () => {
    for (let i = 0; i < 5; i += 1) {
      await UserModel.create({
        username: `listuser${i}`,
        passwordHash: 'hash',
        role: 'user',
        isActive: true,
        tokenVersion: 0,
      });
    }
    await UserModel.create({
      username: 'softdeleted',
      passwordHash: 'hash',
      role: 'user',
      isActive: true,
      tokenVersion: 0,
      deletedAt: new Date(),
    });

    const page1 = await repository.list({ page: 1, limit: 3 });
    const page2 = await repository.list({ page: 2, limit: 3 });

    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(3);
    expect(page2.items).toHaveLength(2);
    expect([...page1.items, ...page2.items].some((u) => u.username === 'softdeleted')).toBe(false);
  });

  it('updates fields and bumps both version and tokenVersion atomically', async () => {
    const created = await repository.create({ username: 'updateme', passwordHash: 'hash', role: 'user' });

    const updated = await repository.update(created.id, created.version, { isActive: false });

    expect(updated).toMatchObject({ isActive: false, version: 1, tokenVersion: 1 });
  });

  it('returns null when the supplied version is stale', async () => {
    const created = await repository.create({ username: 'staleme', passwordHash: 'hash', role: 'user' });
    await repository.update(created.id, created.version, { isActive: false });

    const result = await repository.update(created.id, created.version, { role: 'admin' });

    expect(result).toBeNull();
  });

  it('soft-deletes a user, setting deletedAt and bumping tokenVersion', async () => {
    const created = await repository.create({ username: 'deleteme', passwordHash: 'hash', role: 'user' });

    const result = await repository.softDelete(created.id);

    expect(result).toBe(true);
    const found = await UserModel.findById(created.id);
    expect(found?.deletedAt).toBeInstanceOf(Date);
    expect(found?.tokenVersion).toBe(1);
  });

  it('returns false when soft-deleting an already-deleted user', async () => {
    const created = await repository.create({ username: 'deletetwice', passwordHash: 'hash', role: 'user' });
    await repository.softDelete(created.id);

    expect(await repository.softDelete(created.id)).toBe(false);
  });

  it('counts only active, non-deleted admins', async () => {
    await repository.create({ username: 'admin1', passwordHash: 'hash', role: 'admin' });
    await repository.create({ username: 'admin2', passwordHash: 'hash', role: 'admin' });
    const disabledAdmin = await repository.create({ username: 'admin3', passwordHash: 'hash', role: 'admin' });
    await repository.update(disabledAdmin.id, disabledAdmin.version, { isActive: false });
    await repository.create({ username: 'regular', passwordHash: 'hash', role: 'user' });

    expect(await repository.countActiveAdmins()).toBe(2);
  });
});

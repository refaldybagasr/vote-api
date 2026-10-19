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
});

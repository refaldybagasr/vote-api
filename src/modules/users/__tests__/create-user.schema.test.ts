import { createUserSchema } from '../create-user.schema';

describe('createUserSchema', () => {
  it('accepts a valid payload', () => {
    expect(
      createUserSchema.safeParse({ username: 'new_user.1', password: 'password123', role: 'user' })
        .success,
    ).toBe(true);
  });

  it('rejects an invalid role', () => {
    expect(
      createUserSchema.safeParse({ username: 'valid', password: 'password123', role: 'owner' })
        .success,
    ).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(
      createUserSchema.safeParse({ username: 'valid', password: 'short', role: 'user' }).success,
    ).toBe(false);
  });

  it('rejects unknown fields such as passwordHash or tokenVersion', () => {
    expect(
      createUserSchema.safeParse({
        username: 'valid',
        password: 'password123',
        role: 'user',
        passwordHash: 'hack',
        tokenVersion: 999,
      }).success,
    ).toBe(false);
  });

  it('rejects a username shorter than 3 characters', () => {
    expect(createUserSchema.safeParse({ username: 'ab', password: 'password123', role: 'user' }).success).toBe(
      false,
    );
  });
});

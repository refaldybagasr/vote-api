import { updateUserSchema } from '../update-user.schema';

describe('updateUserSchema', () => {
  it('requires a version', () => {
    expect(updateUserSchema.safeParse({ isActive: false }).success).toBe(false);
  });

  it('accepts a partial update with a version', () => {
    expect(updateUserSchema.safeParse({ version: 0, isActive: false }).success).toBe(true);
  });

  it('rejects unknown fields', () => {
    expect(updateUserSchema.safeParse({ version: 0, username: 'nope' }).success).toBe(false);
  });
});

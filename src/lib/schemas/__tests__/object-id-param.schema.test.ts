import { idParamSchema } from '../object-id-param.schema';

describe('idParamSchema', () => {
  it('accepts a valid 24-character hex ObjectId', () => {
    expect(idParamSchema.safeParse({ id: '507f1f77bcf86cd799439011' }).success).toBe(true);
  });

  it('rejects a non-ObjectId string', () => {
    expect(idParamSchema.safeParse({ id: 'not-an-object-id' }).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(
      idParamSchema.safeParse({ id: '507f1f77bcf86cd799439011', extra: 'nope' }).success,
    ).toBe(false);
  });
});

import mongoose from 'mongoose';
import { DuplicateKeyError } from '../errors';
import { isDuplicateKeyError, toDuplicateKeyError } from '../mongo-errors';

const uniqueFieldSchema = new mongoose.Schema({
  email: { type: String, unique: true },
});
const MongoErrorsScratch = mongoose.model('MongoErrorsScratch', uniqueFieldSchema);

describe('mongo error translation', () => {
  it('recognizes a real duplicate-key error from MongoDB', async () => {
    await MongoErrorsScratch.create({ email: 'a@example.com' });

    let caught: unknown;
    try {
      await MongoErrorsScratch.create({ email: 'a@example.com' });
    } catch (error) {
      caught = error;
    }

    expect(isDuplicateKeyError(caught)).toBe(true);
  });

  it('does not recognize an unrelated error', () => {
    expect(isDuplicateKeyError(new Error('something else'))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });

  it('translates a real duplicate-key error into a DuplicateKeyError naming the field', async () => {
    await MongoErrorsScratch.create({ email: 'b@example.com' });

    let caught: unknown;
    try {
      await MongoErrorsScratch.create({ email: 'b@example.com' });
    } catch (error) {
      caught = error;
    }

    const translated = toDuplicateKeyError(caught);
    expect(translated).toBeInstanceOf(DuplicateKeyError);
    expect(translated.field).toBe('email');
  });

  it('throws if asked to translate a non-duplicate-key error', () => {
    expect(() => toDuplicateKeyError(new Error('not a dup key'))).toThrow();
  });
});

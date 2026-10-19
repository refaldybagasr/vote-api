import mongoose from 'mongoose';
import { configureMongoose } from '../configure-mongoose';

describe('configureMongoose', () => {
  it('enables sanitizeFilter and strictQuery', () => {
    configureMongoose();

    expect(mongoose.get('sanitizeFilter')).toBe(true);
    expect(mongoose.get('strictQuery')).toBe(true);
  });
});

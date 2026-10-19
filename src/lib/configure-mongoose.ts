import mongoose from 'mongoose';

export function configureMongoose(): void {
  mongoose.set('sanitizeFilter', true);
  mongoose.set('strictQuery', true);
}

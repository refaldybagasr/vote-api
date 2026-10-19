import mongoose from 'mongoose';
import { configureMongoose } from '../lib/configure-mongoose';
import { clearDatabase } from './clear-database';
import { syncAllIndexes } from '../lib/sync-indexes';

beforeAll(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set — did globalSetup run?');
  }
  configureMongoose();
  await mongoose.connect(uri);
  await syncAllIndexes();
});

beforeEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
});

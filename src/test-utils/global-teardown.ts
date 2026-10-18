import type { MongoMemoryReplSet } from 'mongodb-memory-server';

type GlobalWithReplSet = typeof globalThis & { __MONGO_REPLSET__?: MongoMemoryReplSet };

export default async function globalTeardown(): Promise<void> {
  const replSet = (globalThis as GlobalWithReplSet).__MONGO_REPLSET__;
  if (replSet) {
    await replSet.stop();
  }
}

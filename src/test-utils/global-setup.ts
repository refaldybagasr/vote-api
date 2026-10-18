import { MongoMemoryReplSet } from 'mongodb-memory-server';

type GlobalWithReplSet = typeof globalThis & { __MONGO_REPLSET__?: MongoMemoryReplSet };

export default async function globalSetup(): Promise<void> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: '8.0.34' },
  });
  await replSet.waitUntilRunning();

  (globalThis as GlobalWithReplSet).__MONGO_REPLSET__ = replSet;
  process.env.MONGO_URI = replSet.getUri();
}

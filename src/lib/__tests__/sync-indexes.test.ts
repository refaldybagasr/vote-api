import mongoose from 'mongoose';

const uniqueFieldSchema = new mongoose.Schema({
  key: { type: String, unique: true },
});
mongoose.model('SyncIndexesScratch', uniqueFieldSchema);

describe('global index sync', () => {
  it('syncs declared indexes (including unique ones) before any test runs', async () => {
    const indexes = await mongoose.connection.collection('syncindexesscratches').indexes();
    const keyIndex = indexes.find((index) => Object.keys(index.key).includes('key'));

    expect(keyIndex).toBeDefined();
    expect(keyIndex?.unique).toBe(true);
  });
});

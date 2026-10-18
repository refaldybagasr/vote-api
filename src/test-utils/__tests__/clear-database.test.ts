import mongoose from 'mongoose';

const scratchSchema = new mongoose.Schema({ label: String });
const Scratch = mongoose.model('ClearDatabaseScratch', scratchSchema);

describe('database cleanup between tests', () => {
  it('starts with no leftover documents from a previous test (part 1: insert)', async () => {
    expect(await Scratch.countDocuments()).toBe(0);
    await Scratch.create({ label: 'leftover' });
    expect(await Scratch.countDocuments()).toBe(1);
  });

  it('starts with no leftover documents from a previous test (part 2: verify)', async () => {
    expect(await Scratch.countDocuments()).toBe(0);
  });
});

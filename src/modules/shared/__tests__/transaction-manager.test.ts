import mongoose from 'mongoose';
import { FakeTransactionManager } from '../fake-transaction-manager';
import { MongooseTransactionManager } from '../transaction-manager';

const txScratchSchema = new mongoose.Schema({ label: String });
const TxScratchA = mongoose.model('TxScratchA', txScratchSchema);
const TxScratchB = mongoose.model('TxScratchB', txScratchSchema);

describe('MongooseTransactionManager', () => {
  it('commits every write made through the callback', async () => {
    const manager = new MongooseTransactionManager();

    await manager.run(async (ctx) => {
      await TxScratchA.create([{ label: 'a' }], { session: ctx.session });
      await TxScratchB.create([{ label: 'b' }], { session: ctx.session });
    });

    expect(await TxScratchA.countDocuments()).toBe(1);
    expect(await TxScratchB.countDocuments()).toBe(1);
  });

  it('rolls back every write when the callback throws', async () => {
    const manager = new MongooseTransactionManager();

    await expect(
      manager.run(async (ctx) => {
        await TxScratchA.create([{ label: 'rollback' }], { session: ctx.session });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await TxScratchA.countDocuments({ label: 'rollback' })).toBe(0);
  });

  it('returns the callback result', async () => {
    const manager = new MongooseTransactionManager();

    const result = await manager.run(async () => 'done');

    expect(result).toBe('done');
  });
});

describe('FakeTransactionManager', () => {
  it('runs the callback once with no real session and returns its result', async () => {
    const manager = new FakeTransactionManager();
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await manager.run(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe('ok');
  });

  it('propagates a thrown error without any rollback machinery', async () => {
    const manager = new FakeTransactionManager();

    await expect(
      manager.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});

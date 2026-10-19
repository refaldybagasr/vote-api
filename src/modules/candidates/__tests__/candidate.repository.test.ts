import mongoose from 'mongoose';
import { CandidateModel } from '../candidate.model';
import { CandidateMongoRepository } from '../candidate.repository';

describe('CandidateMongoRepository', () => {
  const repository = new CandidateMongoRepository();

  it('lists candidates sorted by name ascending', async () => {
    const createdBy = new mongoose.Types.ObjectId();
    await CandidateModel.create([
      { displayName: 'Charlie', normalizedName: 'charlie', createdBy },
      { displayName: 'Alice', normalizedName: 'alice', createdBy },
      { displayName: 'Bob', normalizedName: 'bob', createdBy },
    ]);

    const result = await repository.listSortedByName();

    expect(result.map((c) => c.displayName)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('returns an empty list when there are no candidates', async () => {
    expect(await repository.listSortedByName()).toEqual([]);
  });

  it('does not expose normalizedName or createdBy in the record used for the public list', async () => {
    const createdBy = new mongoose.Types.ObjectId();
    await CandidateModel.create({ displayName: 'Solo', normalizedName: 'solo', createdBy });

    const [candidate] = await repository.listSortedByName();

    expect(candidate).toMatchObject({ displayName: 'Solo' });
    expect(candidate?.id).toBeTruthy();
  });

  it('rejects a duplicate normalizedName', async () => {
    const createdBy = new mongoose.Types.ObjectId();
    await CandidateModel.create({ displayName: 'Dup', normalizedName: 'dup', createdBy });

    await expect(
      CandidateModel.create({ displayName: 'Dup Again', normalizedName: 'dup', createdBy }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});

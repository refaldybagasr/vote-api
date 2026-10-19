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

  it('finds a candidate by id', async () => {
    const createdBy = new mongoose.Types.ObjectId();
    const created = await CandidateModel.create({ displayName: 'Findme', normalizedName: 'findme', createdBy });

    expect(await repository.findById(created._id.toString())).toMatchObject({ displayName: 'Findme' });
  });

  it('returns null for an unknown or invalid id', async () => {
    expect(await repository.findById(new mongoose.Types.ObjectId().toString())).toBeNull();
    expect(await repository.findById('not-an-object-id')).toBeNull();
  });

  it('finds a candidate by normalizedName', async () => {
    const createdBy = new mongoose.Types.ObjectId();
    await CandidateModel.create({ displayName: 'Normalized', normalizedName: 'normalized', createdBy });

    expect(await repository.findByNormalizedName('normalized')).toMatchObject({ displayName: 'Normalized' });
  });

  it('returns null from findByNormalizedName when nothing matches', async () => {
    expect(await repository.findByNormalizedName('nope')).toBeNull();
  });

  describe('upsertByNormalizedName', () => {
    it('creates a new candidate when none exists yet', async () => {
      const createdBy = new mongoose.Types.ObjectId().toString();

      const candidate = await repository.upsertByNormalizedName('newname', 'NewName', createdBy);

      expect(candidate.displayName).toBe('NewName');
      expect(await CandidateModel.countDocuments({ normalizedName: 'newname' })).toBe(1);
    });

    it('returns the existing candidate without changing its displayName', async () => {
      const createdBy = new mongoose.Types.ObjectId().toString();
      await repository.upsertByNormalizedName('existing', 'Existing', createdBy);

      const candidate = await repository.upsertByNormalizedName('existing', 'EXISTING (different casing)', createdBy);

      expect(candidate.displayName).toBe('Existing');
      expect(await CandidateModel.countDocuments({ normalizedName: 'existing' })).toBe(1);
    });
  });
});

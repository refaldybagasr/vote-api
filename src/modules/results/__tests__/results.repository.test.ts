import mongoose from 'mongoose';
import { CandidateModel } from '../../candidates/candidate.model';
import { VoteModel } from '../../votes/vote.model';
import { ResultsMongoRepository } from '../results.repository';

describe('ResultsMongoRepository', () => {
  const repository = new ResultsMongoRepository();

  it('aggregates per-candidate vote counts, including candidates with zero votes', async () => {
    const creator = new mongoose.Types.ObjectId();
    const a = await CandidateModel.create({ displayName: 'Alice', normalizedName: 'alice', createdBy: creator });
    const b = await CandidateModel.create({ displayName: 'Bob', normalizedName: 'bob', createdBy: creator });
    await VoteModel.create({ userId: new mongoose.Types.ObjectId(), candidateId: a._id });
    await VoteModel.create({ userId: new mongoose.Types.ObjectId(), candidateId: a._id });

    const results = await repository.aggregate();

    expect(results).toEqual(
      expect.arrayContaining([
        { candidateId: a._id.toString(), name: 'Alice', votes: 2 },
        { candidateId: b._id.toString(), name: 'Bob', votes: 0 },
      ]),
    );
  });

  it('counts votes from soft-deleted users too (no join against the user collection at all)', async () => {
    const creator = new mongoose.Types.ObjectId();
    const candidate = await CandidateModel.create({
      displayName: 'Solo',
      normalizedName: 'solo',
      createdBy: creator,
    });
    await VoteModel.create({ userId: new mongoose.Types.ObjectId(), candidateId: candidate._id });

    const results = await repository.aggregate();

    expect(results.find((r) => r.candidateId === candidate._id.toString())?.votes).toBe(1);
  });

  it('returns no identifying user information', async () => {
    const creator = new mongoose.Types.ObjectId();
    const candidate = await CandidateModel.create({
      displayName: 'Private',
      normalizedName: 'private',
      createdBy: creator,
    });
    await VoteModel.create({ userId: new mongoose.Types.ObjectId(), candidateId: candidate._id });

    const results = await repository.aggregate();

    expect(JSON.stringify(results)).not.toMatch(/userId/i);
  });
});

import mongoose from 'mongoose';
import { VoteMongoRepository } from '../vote.repository';
import { DuplicateKeyError } from '../../../lib/errors';

describe('VoteMongoRepository', () => {
  const repository = new VoteMongoRepository();

  it('inserts a vote', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const candidateId = new mongoose.Types.ObjectId().toString();

    const vote = await repository.insert(userId, candidateId);

    expect(vote).toMatchObject({ userId, candidateId });
    expect(vote.createdAt).toBeInstanceOf(Date);
  });

  it('throws a domain DuplicateKeyError for a second vote by the same user', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    await repository.insert(userId, new mongoose.Types.ObjectId().toString());

    await expect(repository.insert(userId, new mongoose.Types.ObjectId().toString())).rejects.toBeInstanceOf(
      DuplicateKeyError,
    );
  });

  it('finds a vote by userId', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const candidateId = new mongoose.Types.ObjectId().toString();
    await repository.insert(userId, candidateId);

    const found = await repository.findByUserId(userId);

    expect(found).toMatchObject({ userId, candidateId });
  });

  it('returns null when the user has not voted', async () => {
    expect(await repository.findByUserId(new mongoose.Types.ObjectId().toString())).toBeNull();
  });

  it('findVotedUserIds returns only the ids among the given list who have voted', async () => {
    const voter = new mongoose.Types.ObjectId().toString();
    const nonVoter = new mongoose.Types.ObjectId().toString();
    await repository.insert(voter, new mongoose.Types.ObjectId().toString());

    const voted = await repository.findVotedUserIds([voter, nonVoter]);

    expect(voted).toEqual(new Set([voter]));
  });
});

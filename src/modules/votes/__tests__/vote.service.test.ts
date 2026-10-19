import { AppError } from '../../../lib/errors';
import { FakeTransactionManager } from '../../shared/fake-transaction-manager';
import { FakeCandidateRepository } from '../../candidates/fake-candidate-repository';
import { FakeVoteRepository } from '../fake-vote-repository';
import { VoteService } from '../vote.service';

function build() {
  const candidateRepository = new FakeCandidateRepository();
  const voteRepository = new FakeVoteRepository();
  const service = new VoteService({
    candidateRepository,
    voteRepository,
    transactionManager: new FakeTransactionManager(),
  });
  return { service, candidateRepository, voteRepository };
}

describe('VoteService.castVote', () => {
  it('rejects an admin with FORBIDDEN', async () => {
    const { service } = build();

    await expect(
      service.castVote({ userId: 'user-1', role: 'admin', name: 'Alice' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  });

  it('votes for an existing candidate by id', async () => {
    const { service, candidateRepository } = build();
    const candidate = await candidateRepository.upsertByNormalizedName('alice', 'Alice', 'creator');

    const result = await service.castVote({ userId: 'user-1', role: 'user', candidateId: candidate.id });

    expect(result.status).toBe(201);
    expect(result.vote.candidateName).toBe('Alice');
  });

  it('returns CANDIDATE_NOT_FOUND for an unknown candidateId', async () => {
    const { service } = build();

    await expect(
      service.castVote({ userId: 'user-1', role: 'user', candidateId: 'does-not-exist' }),
    ).rejects.toMatchObject({ code: 'CANDIDATE_NOT_FOUND', statusCode: 404 });
  });

  it('creates a new candidate when voting with a new name', async () => {
    const { service, candidateRepository } = build();

    const result = await service.castVote({ userId: 'user-1', role: 'user', name: 'Brand New' });

    expect(result.status).toBe(201);
    expect(result.vote.candidateName).toBe('Brand New');
    expect(await candidateRepository.findByNormalizedName('brand new')).not.toBeNull();
  });

  it('reuses an existing candidate for an equivalent new name (case/whitespace)', async () => {
    const { service, candidateRepository } = build();
    await candidateRepository.upsertByNormalizedName('budi santoso', 'Budi Santoso', 'creator');

    const result = await service.castVote({ userId: 'user-1', role: 'user', name: '  BUDI   santoso ' });

    expect(result.vote.candidateName).toBe('Budi Santoso');
  });

  it('rejects an empty/invalid name with VALIDATION_ERROR', async () => {
    const { service } = build();

    await expect(
      service.castVote({ userId: 'user-1', role: 'user', name: '   ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  });

  it('idempotent retry for the same candidate returns 200 without creating a second vote', async () => {
    const { service, voteRepository } = build();
    const first = await service.castVote({ userId: 'user-1', role: 'user', name: 'Same' });

    const second = await service.castVote({ userId: 'user-1', role: 'user', name: 'same' });

    expect(second.status).toBe(200);
    expect(second.vote.candidateId).toBe(first.vote.candidateId);
    expect(await voteRepository.countAll()).toBe(1);
  });

  it('rejects a second vote for a different candidate with ALREADY_VOTED', async () => {
    const { service } = build();
    await service.castVote({ userId: 'user-1', role: 'user', name: 'First Choice' });

    await expect(
      service.castVote({ userId: 'user-1', role: 'user', name: 'Second Choice' }),
    ).rejects.toMatchObject({ code: 'ALREADY_VOTED', statusCode: 409 });
  });

  it('rejects a new-name vote with ALREADY_VOTED when the user already voted for something else', async () => {
    // Note: FakeTransactionManager doesn't roll back side effects, so "the candidate is not
    // persisted" (true rollback) is verified at the integration level (vote.routes.test.ts)
    // against a real MongoDB transaction, not here.
    const { service } = build();
    await service.castVote({ userId: 'user-1', role: 'user', name: 'Existing Choice' });

    await expect(
      service.castVote({ userId: 'user-1', role: 'user', name: 'Never Persisted' }),
    ).rejects.toMatchObject({ code: 'ALREADY_VOTED' });
  });

  it('every thrown error is an AppError', async () => {
    const { service } = build();
    try {
      await service.castVote({ userId: 'user-1', role: 'user', candidateId: 'nope' });
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
    }
  });
});

describe('VoteService.getMyVote', () => {
  it('returns hasVoted false and vote null before voting', async () => {
    const { service } = build();

    expect(await service.getMyVote('user-1')).toEqual({ hasVoted: false, vote: null });
  });

  it('returns hasVoted true with the candidate name after voting', async () => {
    const { service } = build();
    await service.castVote({ userId: 'user-1', role: 'user', name: 'Chosen' });

    const result = await service.getMyVote('user-1');

    expect(result.hasVoted).toBe(true);
    expect(result.vote?.candidateName).toBe('Chosen');
  });
});

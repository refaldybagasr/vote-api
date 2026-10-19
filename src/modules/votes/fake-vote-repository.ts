import { DuplicateKeyError } from '../../lib/errors';
import type { VoteRecord, VoteRepository } from './vote.repository';

export class FakeVoteRepository implements VoteRepository {
  private readonly votes: VoteRecord[] = [];
  private counter = 0;

  async insert(userId: string, candidateId: string): Promise<VoteRecord> {
    if (this.votes.some((vote) => vote.userId === userId)) {
      throw new DuplicateKeyError('userId');
    }
    this.counter += 1;
    const record: VoteRecord = {
      id: `fake-vote-${this.counter}`,
      userId,
      candidateId,
      createdAt: new Date(),
    };
    this.votes.push(record);
    return record;
  }

  async findByUserId(userId: string): Promise<VoteRecord | null> {
    return this.votes.find((vote) => vote.userId === userId) ?? null;
  }

  async findVotedUserIds(userIds: string[]): Promise<Set<string>> {
    return new Set(this.votes.filter((vote) => userIds.includes(vote.userId)).map((vote) => vote.userId));
  }

  async countAll(): Promise<number> {
    return this.votes.length;
  }
}

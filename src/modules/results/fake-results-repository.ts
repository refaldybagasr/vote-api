import type { CandidateVoteCount, ResultsRepository } from './results.repository';

export class FakeResultsRepository implements ResultsRepository {
  constructor(private readonly rows: CandidateVoteCount[] = []) {}

  async aggregate(): Promise<CandidateVoteCount[]> {
    return this.rows;
  }
}

import type { ResultsRepository } from './results.repository';

export interface ResultItem {
  candidateId: string;
  name: string;
  votes: number;
  percentage: number;
}

export interface ResultsResponse {
  totalVotes: number;
  results: ResultItem[];
}

export class ResultsService {
  constructor(private readonly repository: ResultsRepository) {}

  async get(): Promise<ResultsResponse> {
    const rows = await this.repository.aggregate();
    const totalVotes = rows.reduce((sum, row) => sum + row.votes, 0);

    const results = rows
      .map((row) => ({
        candidateId: row.candidateId,
        name: row.name,
        votes: row.votes,
        percentage: totalVotes === 0 ? 0 : Math.round((row.votes / totalVotes) * 1000) / 10,
      }))
      .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));

    return { totalVotes, results };
  }
}

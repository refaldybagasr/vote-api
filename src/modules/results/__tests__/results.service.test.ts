import { FakeResultsRepository } from '../fake-results-repository';
import { ResultsService } from '../results.service';

describe('ResultsService.get', () => {
  it('computes totalVotes and per-candidate percentages, rounded to one decimal', async () => {
    const service = new ResultsService(
      new FakeResultsRepository([
        { candidateId: 'a', name: 'Alice', votes: 2 },
        { candidateId: 'b', name: 'Bob', votes: 1 },
      ]),
    );

    const result = await service.get();

    expect(result.totalVotes).toBe(3);
    expect(result.results).toEqual([
      { candidateId: 'a', name: 'Alice', votes: 2, percentage: 66.7 },
      { candidateId: 'b', name: 'Bob', votes: 1, percentage: 33.3 },
    ]);
  });

  it('sorts by votes descending, then name ascending for ties', async () => {
    const service = new ResultsService(
      new FakeResultsRepository([
        { candidateId: 'z', name: 'Zed', votes: 1 },
        { candidateId: 'a', name: 'Amy', votes: 1 },
        { candidateId: 'm', name: 'Max', votes: 5 },
      ]),
    );

    const result = await service.get();

    expect(result.results.map((r) => r.candidateId)).toEqual(['m', 'a', 'z']);
  });

  it('reports 0 percentage for every candidate when totalVotes is 0', async () => {
    const service = new ResultsService(
      new FakeResultsRepository([
        { candidateId: 'a', name: 'Alice', votes: 0 },
        { candidateId: 'b', name: 'Bob', votes: 0 },
      ]),
    );

    const result = await service.get();

    expect(result.totalVotes).toBe(0);
    expect(result.results.every((r) => r.percentage === 0)).toBe(true);
  });

  it('includes candidates with zero votes', async () => {
    const service = new ResultsService(
      new FakeResultsRepository([
        { candidateId: 'a', name: 'Alice', votes: 3 },
        { candidateId: 'b', name: 'Bob', votes: 0 },
      ]),
    );

    const result = await service.get();

    expect(result.results.map((r) => r.candidateId)).toContain('b');
  });
});

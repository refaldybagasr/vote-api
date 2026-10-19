import { CandidateModel } from '../candidates/candidate.model';

export interface CandidateVoteCount {
  candidateId: string;
  name: string;
  votes: number;
}

export interface ResultsRepository {
  aggregate(): Promise<CandidateVoteCount[]>;
}

interface AggregationRow {
  _id: import('mongoose').Types.ObjectId;
  name: string;
  votes: number;
}

export class ResultsMongoRepository implements ResultsRepository {
  async aggregate(): Promise<CandidateVoteCount[]> {
    const rows = await CandidateModel.aggregate<AggregationRow>([
      {
        $lookup: {
          from: 'votes',
          localField: '_id',
          foreignField: 'candidateId',
          as: 'votesForCandidate',
        },
      },
      {
        $project: {
          name: '$displayName',
          votes: { $size: '$votesForCandidate' },
        },
      },
    ]);

    return rows.map((row) => ({ candidateId: row._id.toString(), name: row.name, votes: row.votes }));
  }
}

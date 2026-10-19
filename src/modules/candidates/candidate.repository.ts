import { CandidateModel, type CandidateDoc } from './candidate.model';

export interface CandidateRecord {
  id: string;
  displayName: string;
}

export interface CandidateRepository {
  listSortedByName(): Promise<CandidateRecord[]>;
}

export class CandidateMongoRepository implements CandidateRepository {
  async listSortedByName(): Promise<CandidateRecord[]> {
    const docs = await CandidateModel.find().sort({ displayName: 1 });
    return docs.map((doc) => toRecord(doc));
  }
}

function toRecord(doc: import('mongoose').Document & CandidateDoc): CandidateRecord {
  return {
    id: doc._id.toString(),
    displayName: doc.displayName,
  };
}

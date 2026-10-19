import mongoose from 'mongoose';
import type { TxContext } from '../shared/transaction-manager';
import { sessionOptions } from '../shared/transaction-manager';
import { CandidateModel, type CandidateDoc } from './candidate.model';

export interface CandidateRecord {
  id: string;
  displayName: string;
}

export interface CandidateRepository {
  listSortedByName(): Promise<CandidateRecord[]>;
  findById(id: string, ctx?: TxContext): Promise<CandidateRecord | null>;
  findByNormalizedName(normalizedName: string): Promise<CandidateRecord | null>;
  upsertByNormalizedName(
    normalizedName: string,
    displayName: string,
    createdBy: string,
    ctx?: TxContext,
  ): Promise<CandidateRecord>;
}

export class CandidateMongoRepository implements CandidateRepository {
  async listSortedByName(): Promise<CandidateRecord[]> {
    const docs = await CandidateModel.find().sort({ displayName: 1 });
    return docs.map((doc) => toRecord(doc));
  }

  async findById(id: string, ctx?: TxContext): Promise<CandidateRecord | null> {
    if (!mongoose.isValidObjectId(id)) {
      return null;
    }
    const doc = await CandidateModel.findById(id, null, sessionOptions(ctx));
    return doc ? toRecord(doc) : null;
  }

  async findByNormalizedName(normalizedName: string): Promise<CandidateRecord | null> {
    const doc = await CandidateModel.findOne({ normalizedName });
    return doc ? toRecord(doc) : null;
  }

  async upsertByNormalizedName(
    normalizedName: string,
    displayName: string,
    createdBy: string,
    ctx?: TxContext,
  ): Promise<CandidateRecord> {
    const doc = await CandidateModel.findOneAndUpdate(
      { normalizedName },
      { $setOnInsert: { displayName, normalizedName, createdBy } },
      { upsert: true, new: true, ...sessionOptions(ctx) },
    );
    return toRecord(doc);
  }
}

function toRecord(doc: import('mongoose').Document & CandidateDoc): CandidateRecord {
  return {
    id: doc._id.toString(),
    displayName: doc.displayName,
  };
}

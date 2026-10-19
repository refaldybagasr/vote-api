import mongoose from 'mongoose';
import { toDuplicateKeyError, isDuplicateKeyError } from '../../lib/mongo-errors';
import { sessionOptions, type TxContext } from '../shared/transaction-manager';
import { VoteModel, type VoteDoc } from './vote.model';

export interface VoteRecord {
  id: string;
  userId: string;
  candidateId: string;
  createdAt: Date;
}

export interface VoteRepository {
  insert(userId: string, candidateId: string, ctx?: TxContext): Promise<VoteRecord>;
  findByUserId(userId: string, ctx?: TxContext): Promise<VoteRecord | null>;
  findVotedUserIds(userIds: string[]): Promise<Set<string>>;
}

export class VoteMongoRepository implements VoteRepository {
  async insert(userId: string, candidateId: string, ctx?: TxContext): Promise<VoteRecord> {
    try {
      const [doc] = await VoteModel.create([{ userId, candidateId }], { session: ctx?.session });
      return toRecord(doc as unknown as import('mongoose').Document & VoteDoc & { createdAt: Date });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw toDuplicateKeyError(error);
      }
      throw error;
    }
  }

  async findByUserId(userId: string, ctx?: TxContext): Promise<VoteRecord | null> {
    const doc = await VoteModel.findOne({ userId }, null, sessionOptions(ctx));
    return doc ? toRecord(doc as unknown as import('mongoose').Document & VoteDoc & { createdAt: Date }) : null;
  }

  async findVotedUserIds(userIds: string[]): Promise<Set<string>> {
    const docs = await VoteModel.find({ userId: mongoose.trusted({ $in: userIds }) }, { userId: 1 });
    return new Set(docs.map((doc) => doc.userId.toString()));
  }
}

function toRecord(doc: import('mongoose').Document & VoteDoc & { createdAt: Date }): VoteRecord {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    candidateId: doc.candidateId.toString(),
    createdAt: doc.createdAt,
  };
}

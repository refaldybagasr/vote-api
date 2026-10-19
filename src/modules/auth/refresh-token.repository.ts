import mongoose from 'mongoose';
import { sessionOptions, type TxContext } from '../shared/transaction-manager';
import { RefreshTokenModel, type RefreshTokenDoc } from './refresh-token.model';

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface RefreshTokenRepository {
  create(input: CreateRefreshTokenInput, ctx?: TxContext): Promise<void>;
  rotateByHash(tokenHash: string, now: Date, ctx?: TxContext): Promise<RefreshTokenRecord | null>;
  revokeAllForUser(userId: string, ctx?: TxContext): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
}

export class RefreshTokenMongoRepository implements RefreshTokenRepository {
  async create(input: CreateRefreshTokenInput, ctx?: TxContext): Promise<void> {
    await RefreshTokenModel.create(
      [
        {
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          revokedAt: null,
        },
      ],
      sessionOptions(ctx),
    );
  }

  async rotateByHash(tokenHash: string, now: Date, ctx?: TxContext): Promise<RefreshTokenRecord | null> {
    const doc = await RefreshTokenModel.findOneAndUpdate(
      {
        tokenHash,
        revokedAt: null,
        expiresAt: mongoose.trusted({ $gt: now }),
      },
      { $set: { revokedAt: now } },
      sessionOptions(ctx),
    );
    return doc ? toRecord(doc) : null;
  }

  async revokeAllForUser(userId: string, ctx?: TxContext): Promise<void> {
    await RefreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
      sessionOptions(ctx),
    );
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const doc = await RefreshTokenModel.findOne({ tokenHash });
    return doc ? toRecord(doc) : null;
  }
}

function toRecord(doc: import('mongoose').Document & RefreshTokenDoc): RefreshTokenRecord {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    tokenHash: doc.tokenHash,
    expiresAt: doc.expiresAt,
    revokedAt: doc.revokedAt,
  };
}

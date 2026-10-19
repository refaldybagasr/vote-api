import mongoose from 'mongoose';
import { sessionOptions, type TxContext } from '../shared/transaction-manager';
import type { UserDoc, UserRole } from './user.model';
import { UserModel } from './user.model';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  deletedAt: Date | null;
  tokenVersion: number;
  version: number;
  createdAt: Date;
}

export interface CreateUserInput {
  username: string;
  passwordHash: string;
  role: UserRole;
}

export interface UpdateUserChanges {
  passwordHash?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface ListUsersResult {
  items: UserRecord[];
  total: number;
}

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  incrementTokenVersion(id: string, ctx?: TxContext): Promise<void>;
  create(input: CreateUserInput, ctx?: TxContext): Promise<UserRecord>;
  list(page: { page: number; limit: number }): Promise<ListUsersResult>;
  update(
    id: string,
    expectedVersion: number,
    changes: UpdateUserChanges,
    ctx?: TxContext,
  ): Promise<UserRecord | null>;
  softDelete(id: string, ctx?: TxContext): Promise<boolean>;
  countActiveAdmins(ctx?: TxContext): Promise<number>;
}

type UserDocument = mongoose.Document & UserDoc & { __v: number };

export class UserMongoRepository implements UserRepository {
  async findByUsername(username: string): Promise<UserRecord | null> {
    const doc = await UserModel.findOne({ username: username.toLowerCase() });
    return doc ? toRecord(doc as UserDocument) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (!mongoose.isValidObjectId(id)) {
      return null;
    }
    const doc = await UserModel.findById(id);
    return doc ? toRecord(doc as UserDocument) : null;
  }

  async incrementTokenVersion(id: string, ctx?: TxContext): Promise<void> {
    await UserModel.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } }, sessionOptions(ctx));
  }

  async create(input: CreateUserInput, ctx?: TxContext): Promise<UserRecord> {
    const [doc] = await UserModel.create(
      [
        {
          username: input.username,
          passwordHash: input.passwordHash,
          role: input.role,
          isActive: true,
          deletedAt: null,
          tokenVersion: 0,
        },
      ],
      { session: ctx?.session },
    );
    return toRecord(doc as unknown as UserDocument);
  }

  async list({ page, limit }: { page: number; limit: number }): Promise<ListUsersResult> {
    const filter = { deletedAt: null };
    const [items, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      UserModel.countDocuments(filter),
    ]);
    return { items: items.map((doc) => toRecord(doc as UserDocument)), total };
  }

  async update(
    id: string,
    expectedVersion: number,
    changes: UpdateUserChanges,
    ctx?: TxContext,
  ): Promise<UserRecord | null> {
    if (!mongoose.isValidObjectId(id)) {
      return null;
    }

    const setFields: Record<string, unknown> = {};
    if (changes.passwordHash !== undefined) {
      setFields.passwordHash = changes.passwordHash;
    }
    if (changes.role !== undefined) {
      setFields.role = changes.role;
    }
    if (changes.isActive !== undefined) {
      setFields.isActive = changes.isActive;
    }

    const doc = await UserModel.findOneAndUpdate(
      { _id: id, __v: expectedVersion },
      {
        ...(Object.keys(setFields).length > 0 ? { $set: setFields } : {}),
        $inc: { __v: 1, tokenVersion: 1 },
      },
      { ...sessionOptions(ctx), new: true },
    );

    return doc ? toRecord(doc as UserDocument) : null;
  }

  async softDelete(id: string, ctx?: TxContext): Promise<boolean> {
    if (!mongoose.isValidObjectId(id)) {
      return false;
    }
    const result = await UserModel.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() }, $inc: { tokenVersion: 1 } },
      sessionOptions(ctx),
    );
    return result.modifiedCount === 1;
  }

  async countActiveAdmins(ctx?: TxContext): Promise<number> {
    return UserModel.countDocuments(
      { role: 'admin', isActive: true, deletedAt: null },
      sessionOptions(ctx),
    );
  }
}

function toRecord(doc: UserDocument): UserRecord {
  return {
    id: doc._id.toString(),
    username: doc.username,
    passwordHash: doc.passwordHash,
    role: doc.role,
    isActive: doc.isActive,
    deletedAt: doc.deletedAt,
    tokenVersion: doc.tokenVersion,
    version: doc.__v,
    createdAt: doc.createdAt,
  };
}

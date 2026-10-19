import mongoose from 'mongoose';
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
}

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export class UserMongoRepository implements UserRepository {
  async findByUsername(username: string): Promise<UserRecord | null> {
    const doc = await UserModel.findOne({ username: username.toLowerCase() });
    return doc ? toRecord(doc) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (!mongoose.isValidObjectId(id)) {
      return null;
    }
    const doc = await UserModel.findById(id);
    return doc ? toRecord(doc) : null;
  }
}

function toRecord(doc: mongoose.Document & UserDoc): UserRecord {
  return {
    id: doc._id.toString(),
    username: doc.username,
    passwordHash: doc.passwordHash,
    role: doc.role,
    isActive: doc.isActive,
    deletedAt: doc.deletedAt,
    tokenVersion: doc.tokenVersion,
  };
}

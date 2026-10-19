import mongoose from 'mongoose';

export type UserRole = 'admin' | 'user';

export interface UserDoc {
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  deletedAt: Date | null;
  tokenVersion: number;
}

const userSchema = new mongoose.Schema<UserDoc>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      immutable: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], required: true },
    isActive: { type: Boolean, required: true, default: true },
    deletedAt: { type: Date, default: null },
    tokenVersion: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, optimisticConcurrency: true },
);

export const UserModel = mongoose.model<UserDoc>('User', userSchema);

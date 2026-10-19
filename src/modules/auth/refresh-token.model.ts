import mongoose from 'mongoose';

export interface RefreshTokenDoc {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const refreshTokenSchema = new mongoose.Schema<RefreshTokenDoc>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const RefreshTokenModel = mongoose.model<RefreshTokenDoc>('RefreshToken', refreshTokenSchema);

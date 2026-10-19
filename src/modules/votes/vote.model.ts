import mongoose from 'mongoose';

export interface VoteDoc {
  userId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
}

const voteSchema = new mongoose.Schema<VoteDoc>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, ref: 'User' },
    candidateId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Candidate' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const VoteModel = mongoose.model<VoteDoc>('Vote', voteSchema);

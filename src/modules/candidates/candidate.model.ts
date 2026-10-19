import mongoose from 'mongoose';

export interface CandidateDoc {
  displayName: string;
  normalizedName: string;
  createdBy: mongoose.Types.ObjectId;
}

const candidateSchema = new mongoose.Schema<CandidateDoc>(
  {
    displayName: { type: String, required: true },
    normalizedName: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const CandidateModel = mongoose.model<CandidateDoc>('Candidate', candidateSchema);

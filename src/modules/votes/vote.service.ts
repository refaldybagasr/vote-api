import { AppError, DuplicateKeyError } from '../../lib/errors';
import { normalizeName } from '../../lib/normalize-name';
import { isDuplicateKeyError } from '../../lib/mongo-errors';
import type { CandidateRepository } from '../candidates/candidate.repository';
import type { TransactionManager } from '../shared/transaction-manager';
import type { VoteRepository } from './vote.repository';

export interface PublicVote {
  candidateId: string;
  candidateName: string;
  createdAt: Date;
}

export interface CastVoteRequest {
  userId: string;
  role: string;
  candidateId?: string;
  name?: string;
}

export interface VoteServiceDeps {
  candidateRepository: CandidateRepository;
  voteRepository: VoteRepository;
  transactionManager: TransactionManager;
}

const FORBIDDEN = new AppError('FORBIDDEN', 403, 'Admins cannot vote');
const CANDIDATE_NOT_FOUND = new AppError('CANDIDATE_NOT_FOUND', 404, 'Candidate not found');
const ALREADY_VOTED = new AppError('ALREADY_VOTED', 409, 'You already voted for a different candidate');

export class VoteService {
  constructor(private readonly deps: VoteServiceDeps) {}

  async castVote(request: CastVoteRequest): Promise<{ status: 200 | 201; vote: PublicVote }> {
    if (request.role === 'admin') {
      throw FORBIDDEN;
    }

    const normalized = request.name !== undefined ? normalizeName(request.name) : null;
    if (request.name !== undefined && !normalized) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid candidate name');
    }

    try {
      const result = await this.deps.transactionManager.run(async (ctx) => {
        let candidateId: string;
        let candidateName: string;

        if (normalized) {
          const candidate = await this.deps.candidateRepository.upsertByNormalizedName(
            normalized.normalizedName,
            normalized.displayName,
            request.userId,
            ctx,
          );
          candidateId = candidate.id;
          candidateName = candidate.displayName;
        } else {
          const candidate = await this.deps.candidateRepository.findById(request.candidateId as string, ctx);
          if (!candidate) {
            throw CANDIDATE_NOT_FOUND;
          }
          candidateId = candidate.id;
          candidateName = candidate.displayName;
        }

        const vote = await this.deps.voteRepository.insert(request.userId, candidateId, ctx);
        return { vote, candidateId, candidateName };
      });

      return {
        status: 201,
        vote: {
          candidateId: result.candidateId,
          candidateName: result.candidateName,
          createdAt: result.vote.createdAt,
        },
      };
    } catch (error) {
      if (!(error instanceof DuplicateKeyError) && !isDuplicateKeyError(error)) {
        throw error;
      }
      return this.resolveIdempotentRetry(request, normalized);
    }
  }

  async getMyVote(userId: string): Promise<{ hasVoted: boolean; vote: PublicVote | null }> {
    const vote = await this.deps.voteRepository.findByUserId(userId);
    if (!vote) {
      return { hasVoted: false, vote: null };
    }
    const candidate = await this.deps.candidateRepository.findById(vote.candidateId);
    return {
      hasVoted: true,
      vote: {
        candidateId: vote.candidateId,
        candidateName: candidate?.displayName ?? '',
        createdAt: vote.createdAt,
      },
    };
  }

  private async resolveIdempotentRetry(
    request: CastVoteRequest,
    normalized: ReturnType<typeof normalizeName>,
  ): Promise<{ status: 200; vote: PublicVote }> {
    const existingVote = await this.deps.voteRepository.findByUserId(request.userId);
    if (!existingVote) {
      throw ALREADY_VOTED;
    }

    const attemptedCandidateId = normalized
      ? (await this.deps.candidateRepository.findByNormalizedName(normalized.normalizedName))?.id
      : request.candidateId;

    if (!attemptedCandidateId || existingVote.candidateId !== attemptedCandidateId) {
      throw ALREADY_VOTED;
    }

    const candidate = await this.deps.candidateRepository.findById(existingVote.candidateId);
    return {
      status: 200,
      vote: {
        candidateId: existingVote.candidateId,
        candidateName: candidate?.displayName ?? '',
        createdAt: existingVote.createdAt,
      },
    };
  }
}

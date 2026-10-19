import { AppError } from '../../lib/errors';
import { normalizeName } from '../../lib/normalize-name';
import type { CandidateRepository } from './candidate.repository';

export interface PublicCandidate {
  id: string;
  name: string;
}

const CANDIDATE_NAME_TAKEN = new AppError('CANDIDATE_NAME_TAKEN', 409, 'A candidate with this name already exists');
const VALIDATION_ERROR = new AppError('VALIDATION_ERROR', 400, 'Invalid candidate name');

export class CandidateService {
  constructor(private readonly repository: CandidateRepository) {}

  async list(): Promise<PublicCandidate[]> {
    const candidates = await this.repository.listSortedByName();
    return candidates.map((candidate) => ({ id: candidate.id, name: candidate.displayName }));
  }

  async create(name: string, createdBy: string): Promise<PublicCandidate> {
    const normalized = normalizeName(name);
    if (!normalized) {
      throw VALIDATION_ERROR;
    }

    const existing = await this.repository.findByNormalizedName(normalized.normalizedName);
    if (existing) {
      throw CANDIDATE_NAME_TAKEN;
    }

    const created = await this.repository.upsertByNormalizedName(
      normalized.normalizedName,
      normalized.displayName,
      createdBy,
    );
    return { id: created.id, name: created.displayName };
  }
}

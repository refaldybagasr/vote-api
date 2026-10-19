import type { CandidateRepository } from './candidate.repository';

export interface PublicCandidate {
  id: string;
  name: string;
}

export class CandidateService {
  constructor(private readonly repository: CandidateRepository) {}

  async list(): Promise<PublicCandidate[]> {
    const candidates = await this.repository.listSortedByName();
    return candidates.map((candidate) => ({ id: candidate.id, name: candidate.displayName }));
  }
}

import type { CandidateRecord, CandidateRepository } from './candidate.repository';

export class FakeCandidateRepository implements CandidateRepository {
  private readonly candidates: (CandidateRecord & { normalizedName: string })[] = [];
  private counter = 0;

  async listSortedByName(): Promise<CandidateRecord[]> {
    return [...this.candidates]
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map(({ id, displayName }) => ({ id, displayName }));
  }

  async findById(id: string): Promise<CandidateRecord | null> {
    const found = this.candidates.find((candidate) => candidate.id === id);
    return found ? { id: found.id, displayName: found.displayName } : null;
  }

  async findByNormalizedName(normalizedName: string): Promise<CandidateRecord | null> {
    const found = this.candidates.find((candidate) => candidate.normalizedName === normalizedName);
    return found ? { id: found.id, displayName: found.displayName } : null;
  }

  async upsertByNormalizedName(
    normalizedName: string,
    displayName: string,
    _createdBy: string,
  ): Promise<CandidateRecord> {
    const existing = this.candidates.find((candidate) => candidate.normalizedName === normalizedName);
    if (existing) {
      return { id: existing.id, displayName: existing.displayName };
    }
    this.counter += 1;
    const created = { id: `fake-candidate-${this.counter}`, displayName, normalizedName };
    this.candidates.push(created);
    return { id: created.id, displayName: created.displayName };
  }
}

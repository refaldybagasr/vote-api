import type {
  CreateRefreshTokenInput,
  RefreshTokenRecord,
  RefreshTokenRepository,
} from './refresh-token.repository';

export class FakeRefreshTokenRepository implements RefreshTokenRepository {
  private readonly tokens: RefreshTokenRecord[] = [];
  private counter = 0;

  async create(input: CreateRefreshTokenInput): Promise<void> {
    this.counter += 1;
    this.tokens.push({
      id: String(this.counter),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
    });
  }

  async rotateByHash(tokenHash: string, now: Date): Promise<RefreshTokenRecord | null> {
    const token = this.tokens.find(
      (candidate) =>
        candidate.tokenHash === tokenHash &&
        candidate.revokedAt === null &&
        candidate.expiresAt.getTime() > now.getTime(),
    );
    if (!token) {
      return null;
    }
    token.revokedAt = now;
    return { ...token };
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const now = new Date();
    for (const token of this.tokens) {
      if (token.userId === userId && token.revokedAt === null) {
        token.revokedAt = now;
      }
    }
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.tokens.find((candidate) => candidate.tokenHash === tokenHash) ?? null;
  }
}

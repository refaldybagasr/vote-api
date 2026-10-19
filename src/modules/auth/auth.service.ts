import { AppError } from '../../lib/errors';
import type { JwtConfig } from '../../lib/jwt';
import { signAccessToken } from '../../lib/jwt';
import { PasswordTooLongError, verifyPassword } from '../../lib/password';
import { generateRefreshToken, hashRefreshToken } from '../../lib/refresh-token-crypto';
import type { TransactionManager } from '../shared/transaction-manager';
import type { RefreshTokenRepository } from './refresh-token.repository';
import type { UserRepository } from '../users/user.repository';

export interface PublicUser {
  id: string;
  username: string;
  role: string;
}

export interface AuthServiceDeps {
  userRepository: UserRepository;
  refreshTokenRepository: RefreshTokenRepository;
  transactionManager: TransactionManager;
  jwtConfig: JwtConfig;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  dummyPasswordHash: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

const INVALID_CREDENTIALS = new AppError('INVALID_CREDENTIALS', 401, 'Invalid username or password');
const INVALID_REFRESH_TOKEN = new AppError('UNAUTHORIZED', 401, 'Invalid or expired refresh token');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async login(username: string, password: string): Promise<AuthResult> {
    const user = await this.deps.userRepository.findByUsername(username);
    const hashToCompare = user ? user.passwordHash : this.deps.dummyPasswordHash;

    let passwordMatches: boolean;
    try {
      passwordMatches = await verifyPassword(password, hashToCompare);
    } catch (error) {
      if (error instanceof PasswordTooLongError) {
        throw INVALID_CREDENTIALS;
      }
      throw error;
    }

    if (!user || !passwordMatches || !user.isActive || user.deletedAt) {
      throw INVALID_CREDENTIALS;
    }

    const accessToken = signAccessToken(
      { sub: user.id, role: user.role, tv: user.tokenVersion },
      this.deps.accessTokenTtlSeconds,
      this.deps.jwtConfig,
    );
    const refreshToken = await this.issueRefreshToken(user.id);

    return { accessToken, refreshToken, user: toPublicUser(user.id, user.username, user.role) };
  }

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const now = this.deps.jwtConfig.clock.now();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const rotated = await this.deps.refreshTokenRepository.rotateByHash(tokenHash, now);
    if (!rotated) {
      throw INVALID_REFRESH_TOKEN;
    }

    const user = await this.deps.userRepository.findById(rotated.userId);
    if (!user || !user.isActive || user.deletedAt) {
      throw INVALID_REFRESH_TOKEN;
    }

    const accessToken = signAccessToken(
      { sub: user.id, role: user.role, tv: user.tokenVersion },
      this.deps.accessTokenTtlSeconds,
      this.deps.jwtConfig,
    );
    const refreshToken = await this.issueRefreshToken(user.id);

    return { accessToken, refreshToken, user: toPublicUser(user.id, user.username, user.role) };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);
    const record = await this.deps.refreshTokenRepository.findByHash(tokenHash);
    if (!record) {
      return;
    }

    await this.deps.transactionManager.run(async (ctx) => {
      await this.deps.refreshTokenRepository.revokeAllForUser(record.userId, ctx);
      await this.deps.userRepository.incrementTokenVersion(record.userId, ctx);
    });
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const { raw, hash } = generateRefreshToken();
    const expiresAt = new Date(
      this.deps.jwtConfig.clock.now().getTime() + this.deps.refreshTokenTtlDays * MS_PER_DAY,
    );
    await this.deps.refreshTokenRepository.create({ userId, tokenHash: hash, expiresAt });
    return raw;
  }
}

function toPublicUser(id: string, username: string, role: string): PublicUser {
  return { id, username, role };
}

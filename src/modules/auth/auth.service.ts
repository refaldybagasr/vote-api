import { AppError } from '../../lib/errors';
import type { JwtConfig } from '../../lib/jwt';
import { signAccessToken } from '../../lib/jwt';
import { PasswordTooLongError, verifyPassword } from '../../lib/password';
import type { UserRepository } from '../users/user.repository';

export interface PublicUser {
  id: string;
  username: string;
  role: string;
}

export interface AuthServiceDeps {
  userRepository: UserRepository;
  jwtConfig: JwtConfig;
  accessTokenTtlSeconds: number;
  dummyPasswordHash: string;
}

const INVALID_CREDENTIALS = new AppError('INVALID_CREDENTIALS', 401, 'Invalid username or password');

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async login(username: string, password: string): Promise<{ accessToken: string; user: PublicUser }> {
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

    return { accessToken, user: toPublicUser(user.id, user.username, user.role) };
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.deps.userRepository.findById(id);
    if (!user || user.deletedAt) {
      throw new AppError('UNAUTHORIZED', 401, 'User not found');
    }
    return toPublicUser(user.id, user.username, user.role);
  }
}

function toPublicUser(id: string, username: string, role: string): PublicUser {
  return { id, username, role };
}

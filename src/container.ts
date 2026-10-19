import type { RequestHandler, Router } from 'express';
import type { AppConfig } from './config/schema';
import { systemClock } from './lib/clock';
import { hashPassword } from './lib/password';
import { createAuthenticate } from './middlewares/authenticate';
import { requireAllowedOrigin } from './middlewares/require-allowed-origin';
import { createAuthRouter } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { RefreshTokenMongoRepository } from './modules/auth/refresh-token.repository';
import { MongooseTransactionManager } from './modules/shared/transaction-manager';
import { UserMongoRepository } from './modules/users/user.repository';

export interface Container {
  authRouter: Router;
  authenticate: RequestHandler;
}

const DUMMY_PASSWORD = 'dummy-password-for-timing-safety';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function buildContainer(config: AppConfig): Promise<Container> {
  const userRepository = new UserMongoRepository();
  const refreshTokenRepository = new RefreshTokenMongoRepository();
  const transactionManager = new MongooseTransactionManager();
  const dummyPasswordHash = await hashPassword(DUMMY_PASSWORD, config.BCRYPT_COST);

  const jwtConfig = {
    secret: config.JWT_ACCESS_SECRET,
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
    clock: systemClock,
  };

  const authenticate = createAuthenticate(userRepository, jwtConfig);

  const authService = new AuthService({
    userRepository,
    refreshTokenRepository,
    transactionManager,
    jwtConfig,
    accessTokenTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: config.REFRESH_TOKEN_TTL_DAYS,
    dummyPasswordHash,
  });

  const authRouter = createAuthRouter({
    authService,
    authenticate,
    requireAllowedOrigin: requireAllowedOrigin(config.FRONTEND_ORIGIN),
    cookieOptions: {
      secure: config.COOKIE_SECURE,
      maxAgeMs: config.REFRESH_TOKEN_TTL_DAYS * MS_PER_DAY,
    },
    rateLimitMax: config.LOGIN_RATE_LIMIT_MAX,
    rateLimitWindowMs: config.LOGIN_RATE_LIMIT_WINDOW_MS,
  });

  return { authRouter, authenticate };
}

import type { RequestHandler, Router } from 'express';
import type { AppConfig } from './config/schema';
import { systemClock } from './lib/clock';
import { hashPassword } from './lib/password';
import { createAuthenticate } from './middlewares/authenticate';
import { createAuthRouter } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { UserMongoRepository } from './modules/users/user.repository';

export interface Container {
  authRouter: Router;
  authenticate: RequestHandler;
}

const DUMMY_PASSWORD = 'dummy-password-for-timing-safety';

export async function buildContainer(config: AppConfig): Promise<Container> {
  const userRepository = new UserMongoRepository();
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
    jwtConfig,
    accessTokenTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
    dummyPasswordHash,
  });

  const authRouter = createAuthRouter({
    authService,
    authenticate,
    rateLimitMax: config.LOGIN_RATE_LIMIT_MAX,
    rateLimitWindowMs: config.LOGIN_RATE_LIMIT_WINDOW_MS,
  });

  return { authRouter, authenticate };
}

import type { RequestHandler, Router } from 'express';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import type { AppConfig } from './config/schema';
import { createOpenApiRegistry } from './docs/registry';
import { createDocsRouter } from './docs/docs.routes';
import { systemClock } from './lib/clock';
import { hashPassword } from './lib/password';
import { createAuthenticate } from './middlewares/authenticate';
import { requireAllowedOrigin } from './middlewares/require-allowed-origin';
import { createAuthRouter } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { RefreshTokenMongoRepository } from './modules/auth/refresh-token.repository';
import { createCandidateRouter } from './modules/candidates/candidate.routes';
import { CandidateMongoRepository } from './modules/candidates/candidate.repository';
import { CandidateService } from './modules/candidates/candidate.service';
import { createResultsRouter } from './modules/results/results.routes';
import { ResultsMongoRepository } from './modules/results/results.repository';
import { ResultsService } from './modules/results/results.service';
import { MongooseTransactionManager } from './modules/shared/transaction-manager';
import { createUserRouter } from './modules/users/user.routes';
import { UserService } from './modules/users/user.service';
import { UserMongoRepository } from './modules/users/user.repository';
import { createVoteRouter } from './modules/votes/vote.routes';
import { VoteMongoRepository } from './modules/votes/vote.repository';
import { VoteService } from './modules/votes/vote.service';

export interface Container {
  authRouter: Router;
  usersRouter: Router;
  candidatesRouter: Router;
  votesRouter: Router;
  resultsRouter: Router;
  docsRouter: Router | null;
  authenticate: RequestHandler;
  openApiRegistry: OpenAPIRegistry;
}

const DUMMY_PASSWORD = 'dummy-password-for-timing-safety';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function buildContainer(config: AppConfig): Promise<Container> {
  const registry = createOpenApiRegistry();
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
    registry,
  });

  const candidateRepository = new CandidateMongoRepository();
  const voteRepository = new VoteMongoRepository();

  const userService = new UserService({
    userRepository,
    refreshTokenRepository,
    transactionManager,
    bcryptCost: config.BCRYPT_COST,
    hasVotedLookup: (userIds) => voteRepository.findVotedUserIds(userIds),
  });

  const usersRouter = createUserRouter({ userService, authenticate, registry });

  const candidateService = new CandidateService(candidateRepository);
  const candidatesRouter = createCandidateRouter({ candidateService, authenticate, registry });

  const voteService = new VoteService({ candidateRepository, voteRepository, transactionManager });
  const votesRouter = createVoteRouter({ voteService, authenticate, registry });

  const resultsService = new ResultsService(new ResultsMongoRepository());
  const resultsRouter = createResultsRouter({ resultsService, authenticate, registry });

  const docsRouter = config.DOCS_ENABLED ? createDocsRouter(registry) : null;

  return {
    authRouter,
    usersRouter,
    candidatesRouter,
    votesRouter,
    resultsRouter,
    docsRouter,
    authenticate,
    openApiRegistry: registry,
  };
}

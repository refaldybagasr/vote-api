import express from 'express';
import request from 'supertest';
import { ManualClock } from '../../../lib/clock';
import { hashPassword } from '../../../lib/password';
import { createTestUser } from '../../../test-utils/user-factory';
import { createAuthenticate } from '../../../middlewares/authenticate';
import { UserMongoRepository } from '../../users/user.repository';
import { AuthService } from '../auth.service';
import { createAuthRouter } from '../auth.routes';

const JWT_CONFIG_BASE = {
  secret: 'a-sufficiently-long-test-secret',
  issuer: 'vote-api',
  audience: 'vote-web',
};

async function buildApp(options: { rateLimitMax?: number; clock?: ManualClock } = {}) {
  const clock = options.clock ?? new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
  const jwtConfig = { ...JWT_CONFIG_BASE, clock };
  const dummyPasswordHash = await hashPassword('dummy-password-for-timing-safety', 4);
  const userRepository = new UserMongoRepository();

  const authService = new AuthService({
    userRepository,
    jwtConfig,
    accessTokenTtlSeconds: 900,
    dummyPasswordHash,
  });

  const app = express();
  app.use(express.json());
  app.use(
    '/api/auth',
    createAuthRouter({
      authService,
      authenticate: createAuthenticate(userRepository, jwtConfig),
      rateLimitMax: options.rateLimitMax ?? 100,
      rateLimitWindowMs: 60_000,
    }),
  );
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const appError = err as { statusCode?: number; code?: string; message?: string };
      res
        .status(appError.statusCode ?? 500)
        .json({ error: { code: appError.code ?? 'INTERNAL_ERROR', message: appError.message } });
    },
  );

  return { app, clock };
}

describe('POST /api/auth/login', () => {
  it('returns 200 with an access token and the public user on success', async () => {
    const { app } = await buildApp();
    const { user, password } = await createTestUser({ username: 'admin', role: 'admin' });

    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user: { username: 'admin', role: 'admin' } });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeTruthy();
    void user;
  });

  it('is case-insensitive on username', async () => {
    const { app } = await buildApp();
    const { password } = await createTestUser({ username: 'admin' });

    const res = await request(app).post('/api/auth/login').send({ username: 'ADMIN', password });

    expect(res.status).toBe(200);
  });

  it('returns 401 INVALID_CREDENTIALS for the wrong password', async () => {
    const { app } = await buildApp();
    await createTestUser({ username: 'admin' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 with the same code and message for an unknown username', async () => {
    const { app } = await buildApp();
    await createTestUser({ username: 'admin' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    const unknownUsername = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'wrong' });

    expect(unknownUsername.status).toBe(401);
    expect(unknownUsername.body).toEqual(wrongPassword.body);
  });

  it('returns 401 for a disabled user', async () => {
    const { app } = await buildApp();
    const { password } = await createTestUser({ username: 'disabled', isActive: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'disabled', password });

    expect(res.status).toBe(401);
  });

  it('returns 401 for a soft-deleted user', async () => {
    const { app } = await buildApp();
    const { password } = await createTestUser({ username: 'deleted', deletedAt: new Date() });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'deleted', password });

    expect(res.status).toBe(401);
  });

  it('returns 400 for missing fields', async () => {
    const { app } = await buildApp();

    const res = await request(app).post('/api/auth/login').send({ username: 'admin' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a NoSQL-injection-shaped username', async () => {
    const { app } = await buildApp();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: { $ne: null }, password: 'x' });

    expect(res.status).toBe(400);
  });

  it('returns 429 once the login rate limit is exceeded', async () => {
    const { app } = await buildApp({ rateLimitMax: 2 });
    await createTestUser({ username: 'admin' });

    await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
    await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const { app } = await buildApp();
    const { password } = await createTestUser({ username: 'admin', role: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'admin', role: 'admin' });
  });

  it('returns 401 with no Authorization header', async () => {
    const { app } = await buildApp();

    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed Authorization header', async () => {
    const { app } = await buildApp();

    const res = await request(app).get('/api/auth/me').set('Authorization', 'Token xxx');

    expect(res.status).toBe(401);
  });
});

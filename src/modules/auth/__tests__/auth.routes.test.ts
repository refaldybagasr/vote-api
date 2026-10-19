import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { ManualClock } from '../../../lib/clock';
import { hashPassword } from '../../../lib/password';
import { createTestUser } from '../../../test-utils/user-factory';
import { createAuthenticate } from '../../../middlewares/authenticate';
import { requireAllowedOrigin } from '../../../middlewares/require-allowed-origin';
import { MongooseTransactionManager } from '../../shared/transaction-manager';
import { UserMongoRepository } from '../../users/user.repository';
import { AuthService } from '../auth.service';
import { RefreshTokenMongoRepository } from '../refresh-token.repository';
import { createAuthRouter } from '../auth.routes';

const JWT_CONFIG_BASE = {
  secret: 'a-sufficiently-long-test-secret',
  issuer: 'vote-api',
  audience: 'vote-web',
};
const FRONTEND_ORIGIN = 'http://localhost:5173';

async function buildApp(options: { rateLimitMax?: number; clock?: ManualClock } = {}) {
  const clock = options.clock ?? new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
  const jwtConfig = { ...JWT_CONFIG_BASE, clock };
  const dummyPasswordHash = await hashPassword('dummy-password-for-timing-safety', 4);
  const userRepository = new UserMongoRepository();
  const refreshTokenRepository = new RefreshTokenMongoRepository();

  const authService = new AuthService({
    userRepository,
    refreshTokenRepository,
    transactionManager: new MongooseTransactionManager(),
    jwtConfig,
    accessTokenTtlSeconds: 900,
    refreshTokenTtlDays: 7,
    dummyPasswordHash,
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    '/api/auth',
    createAuthRouter({
      authService,
      authenticate: createAuthenticate(userRepository, jwtConfig),
      requireAllowedOrigin: requireAllowedOrigin(FRONTEND_ORIGIN),
      cookieOptions: { secure: false, maxAgeMs: 7 * 24 * 60 * 60 * 1000 },
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

function extractCookieValue(setCookieHeader: string[] | undefined, name: string): string | undefined {
  const line = setCookieHeader?.find((entry) => entry.startsWith(`${name}=`));
  return line?.split(';')[0]?.split('=')[1];
}

describe('POST /api/auth/login', () => {
  it('returns 200 with an access token, the public user, and sets the refresh cookie', async () => {
    const { app } = await buildApp();
    await createTestUser({ username: 'admin', role: 'admin' });
    const found = await createTestUser({ username: 'admin2', role: 'admin' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin2', password: found.password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user: { username: 'admin2', role: 'admin' } });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeUndefined();

    const cookieHeader = res.headers['set-cookie'] as unknown as string[];
    const cookieLine = cookieHeader.find((entry) => entry.startsWith('refresh_token='));
    expect(cookieLine).toBeTruthy();
    expect(cookieLine).toMatch(/HttpOnly/i);
    expect(cookieLine).toMatch(/SameSite=Strict/i);
    expect(cookieLine).toMatch(/Path=\/api\/auth/i);
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

  it('returns 401 for an access token older than 15 minutes (injected clock)', async () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const { app } = await buildApp({ clock });
    const { password } = await createTestUser({ username: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password });

    clock.advance(16 * 60 * 1000);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 200 with a new access token and rotates the refresh cookie', async () => {
    const { app } = await buildApp();
    const { password } = await createTestUser({ username: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password });
    const firstCookie = extractCookieValue(login.headers['set-cookie'] as unknown as string[], 'refresh_token');

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', `refresh_token=${firstCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    const newCookie = extractCookieValue(res.headers['set-cookie'] as unknown as string[], 'refresh_token');
    expect(newCookie).toBeTruthy();
    expect(newCookie).not.toBe(firstCookie);
  });

  it('returns 401 when the same (already-rotated) token is reused', async () => {
    const { app } = await buildApp();
    const { password } = await createTestUser({ username: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password });
    const firstCookie = extractCookieValue(login.headers['set-cookie'] as unknown as string[], 'refresh_token');

    await request(app)
      .post('/api/auth/refresh')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', `refresh_token=${firstCookie}`);
    const reuse = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', `refresh_token=${firstCookie}`);

    expect(reuse.status).toBe(401);
  });

  it('exactly one of 5 concurrent refreshes with the same token succeeds', async () => {
    const { app } = await buildApp();
    const { password } = await createTestUser({ username: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password });
    const cookie = extractCookieValue(login.headers['set-cookie'] as unknown as string[], 'refresh_token');

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/auth/refresh')
          .set('Origin', FRONTEND_ORIGIN)
          .set('Cookie', `refresh_token=${cookie}`),
      ),
    );

    expect(results.filter((res) => res.status === 200)).toHaveLength(1);
  });

  it('returns 401 with no cookie', async () => {
    const { app } = await buildApp();

    const res = await request(app).post('/api/auth/refresh').set('Origin', FRONTEND_ORIGIN);

    expect(res.status).toBe(401);
  });

  it('returns 401 for a random, never-issued token', async () => {
    const { app } = await buildApp();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', 'refresh_token=not-a-real-token');

    expect(res.status).toBe(401);
  });

  it('returns 403 ORIGIN_NOT_ALLOWED for a disallowed Origin', async () => {
    const { app } = await buildApp();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', 'http://evil.example.com')
      .set('Cookie', 'refresh_token=whatever');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });
});

describe('POST /api/auth/logout', () => {
  it('is idempotent and returns 204 even with no cookie at all', async () => {
    const { app } = await buildApp();

    const res = await request(app).post('/api/auth/logout').set('Origin', FRONTEND_ORIGIN);

    expect(res.status).toBe(204);
  });

  it('works without any Authorization header (no access token required)', async () => {
    const { app } = await buildApp();
    const { password } = await createTestUser({ username: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password });
    const cookie = extractCookieValue(login.headers['set-cookie'] as unknown as string[], 'refresh_token');

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', `refresh_token=${cookie}`);

    expect(res.status).toBe(204);
  });

  it('clears the cookie, and afterwards both refresh and the old access token are rejected', async () => {
    const { app } = await buildApp();
    const { password } = await createTestUser({ username: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password });
    const cookie = extractCookieValue(login.headers['set-cookie'] as unknown as string[], 'refresh_token');

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', `refresh_token=${cookie}`);
    const clearedCookie = (logout.headers['set-cookie'] as unknown as string[]).find((entry) =>
      entry.startsWith('refresh_token='),
    );
    expect(clearedCookie).toMatch(/refresh_token=;/);

    const refreshAfterLogout = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', `refresh_token=${cookie}`);
    expect(refreshAfterLogout.status).toBe(401);

    const meWithOldAccessToken = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(meWithOldAccessToken.status).toBe(401);
  });

  it('returns 403 ORIGIN_NOT_ALLOWED for a disallowed Origin', async () => {
    const { app } = await buildApp();

    const res = await request(app).post('/api/auth/logout').set('Origin', 'http://evil.example.com');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });
});

import express from 'express';
import request from 'supertest';
import { ManualClock } from '../../lib/clock';
import { signAccessToken } from '../../lib/jwt';
import { UserMongoRepository } from '../../modules/users/user.repository';
import { createTestUser } from '../../test-utils/user-factory';
import { authorize } from '../authorize';
import { createAuthenticate } from '../authenticate';

const JWT_CONFIG_BASE = {
  secret: 'a-sufficiently-long-test-secret',
  issuer: 'vote-api',
  audience: 'vote-web',
};

function buildApp() {
  const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
  const jwtConfig = { ...JWT_CONFIG_BASE, clock };
  const authenticateMw = createAuthenticate(new UserMongoRepository(), jwtConfig);

  const app = express();
  app.get('/admin-only', authenticateMw, authorize('admin'), (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const appError = err as { statusCode?: number; code?: string };
      res.status(appError.statusCode ?? 500).json({ error: { code: appError.code } });
    },
  );

  return { app, jwtConfig };
}

describe('RBAC matrix', () => {
  it('a user role hitting an admin-only route gets 403', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'plain', role: 'user' });
    const token = signAccessToken({ sub: user._id.toString(), role: 'user', tv: 0 }, 900, jwtConfig);

    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('an admin role hitting an admin-only route gets 200', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'boss', role: 'admin' });
    const token = signAccessToken({ sub: user._id.toString(), role: 'admin', tv: 0 }, 900, jwtConfig);

    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

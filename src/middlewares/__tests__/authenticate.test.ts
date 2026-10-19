import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { ManualClock } from '../../lib/clock';
import { signAccessToken } from '../../lib/jwt';
import { UserMongoRepository } from '../../modules/users/user.repository';
import { createTestUser } from '../../test-utils/user-factory';
import { createAuthenticate } from '../authenticate';

const JWT_CONFIG_BASE = {
  secret: 'a-sufficiently-long-test-secret',
  issuer: 'vote-api',
  audience: 'vote-web',
};

function buildApp(clock: ManualClock) {
  const jwtConfig = { ...JWT_CONFIG_BASE, clock };
  const app = express();
  app.get('/protected', createAuthenticate(new UserMongoRepository(), jwtConfig), (req, res) => {
    res.status(200).json(req.auth);
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

describe('authenticate', () => {
  it('attaches req.auth for a valid token', async () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const { app, jwtConfig } = buildApp(clock);
    const { user } = await createTestUser({ username: 'admin', role: 'admin' });
    const token = signAccessToken({ sub: user._id.toString(), role: 'admin', tv: 0 }, 900, jwtConfig);

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: user._id.toString(), username: 'admin', role: 'admin' });
  });

  it('returns 401 with no Authorization header', async () => {
    const { app } = buildApp(new ManualClock(new Date()));

    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed Authorization header', async () => {
    const { app } = buildApp(new ManualClock(new Date()));

    const res = await request(app).get('/protected').set('Authorization', 'Token xxx');

    expect(res.status).toBe(401);
  });

  it('returns 401 when the tokenVersion does not match the database', async () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const { app, jwtConfig } = buildApp(clock);
    const { user } = await createTestUser({ username: 'admin' });
    const staleToken = signAccessToken({ sub: user._id.toString(), role: 'user', tv: 999 }, 900, jwtConfig);

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${staleToken}`);

    expect(res.status).toBe(401);
  });

  it('takes the role from the database, not the token, for a demoted user', async () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const { app, jwtConfig } = buildApp(clock);
    const { user } = await createTestUser({ username: 'exadmin', role: 'user' });
    const oldAdminToken = signAccessToken({ sub: user._id.toString(), role: 'admin', tv: 0 }, 900, jwtConfig);

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${oldAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('user');
  });

  it('returns 401 for a disabled user', async () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const { app, jwtConfig } = buildApp(clock);
    const { user } = await createTestUser({ username: 'disabled', isActive: false });
    const token = signAccessToken({ sub: user._id.toString(), role: 'user', tv: 0 }, 900, jwtConfig);

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for a soft-deleted user', async () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const { app, jwtConfig } = buildApp(clock);
    const { user } = await createTestUser({ username: 'deleted', deletedAt: new Date() });
    const token = signAccessToken({ sub: user._id.toString(), role: 'user', tv: 0 }, 900, jwtConfig);

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for an unknown user id', async () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const { app, jwtConfig } = buildApp(clock);
    const token = signAccessToken(
      { sub: new mongoose.Types.ObjectId().toString(), role: 'user', tv: 0 },
      900,
      jwtConfig,
    );

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});

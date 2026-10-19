import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { ManualClock } from '../../../lib/clock';
import { signAccessToken } from '../../../lib/jwt';
import { createAuthenticate } from '../../../middlewares/authenticate';
import { createTestUser } from '../../../test-utils/user-factory';
import { UserMongoRepository } from '../../users/user.repository';
import { CandidateModel } from '../candidate.model';
import { CandidateMongoRepository } from '../candidate.repository';
import { CandidateService } from '../candidate.service';
import { createCandidateRouter } from '../candidate.routes';
import { createOpenApiRegistry } from '../../../docs/registry';

const JWT_CONFIG_BASE = {
  secret: 'a-sufficiently-long-test-secret',
  issuer: 'vote-api',
  audience: 'vote-web',
};

function buildApp() {
  const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
  const jwtConfig = { ...JWT_CONFIG_BASE, clock };
  const userRepository = new UserMongoRepository();
  const candidateService = new CandidateService(new CandidateMongoRepository());

  const app = express();
  app.use(express.json());
  app.use(
    '/api/candidates',
    createCandidateRouter({
      candidateService,
      authenticate: createAuthenticate(userRepository, jwtConfig),
      registry: createOpenApiRegistry(),
    }),
  );
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

describe('GET /api/candidates', () => {
  it('returns candidates sorted by name for an authenticated user', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'voter' });
    const token = signAccessToken({ sub: user._id.toString(), role: 'user', tv: 0 }, 900, jwtConfig);
    const createdBy = new mongoose.Types.ObjectId();
    await CandidateModel.create([
      { displayName: 'Zed', normalizedName: 'zed', createdBy },
      { displayName: 'Amy', normalizedName: 'amy', createdBy },
    ]);

    const res = await request(app).get('/api/candidates').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(String), name: 'Amy' },
      { id: expect.any(String), name: 'Zed' },
    ]);
  });

  it('returns 401 with no token', async () => {
    const { app } = buildApp();

    const res = await request(app).get('/api/candidates');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/candidates', () => {
  it('lets an admin create a candidate, which then appears in GET /api/candidates', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin10', role: 'admin' });
    const adminToken = signAccessToken({ sub: admin._id.toString(), role: 'admin', tv: 0 }, 900, jwtConfig);

    const res = await request(app)
      .post('/api/candidates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ayu Lestari' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Ayu Lestari' });

    const list = await request(app).get('/api/candidates').set('Authorization', `Bearer ${adminToken}`);
    expect(list.body).toEqual([{ id: res.body.id, name: 'Ayu Lestari' }]);
  });

  it('returns 409 CANDIDATE_NAME_TAKEN for a duplicate name (case/spacing-insensitive)', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin11', role: 'admin' });
    const adminToken = signAccessToken({ sub: admin._id.toString(), role: 'admin', tv: 0 }, 900, jwtConfig);
    await request(app)
      .post('/api/candidates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Budi Santoso' });

    const res = await request(app)
      .post('/api/candidates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '  BUDI   santoso ' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANDIDATE_NAME_TAKEN');
  });

  it('returns 400 for an invalid name', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin12', role: 'admin' });
    const adminToken = signAccessToken({ sub: admin._id.toString(), role: 'admin', tv: 0 }, 900, jwtConfig);

    const res = await request(app)
      .post('/api/candidates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '<script>' });

    expect(res.status).toBe(400);
  });

  it('returns 403 for a non-admin', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'notadmin' });
    const token = signAccessToken({ sub: user._id.toString(), role: 'user', tv: 0 }, 900, jwtConfig);

    const res = await request(app)
      .post('/api/candidates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Someone' });

    expect(res.status).toBe(403);
  });

  it('returns 401 with no token', async () => {
    const { app } = buildApp();

    const res = await request(app).post('/api/candidates').send({ name: 'Someone' });

    expect(res.status).toBe(401);
  });
});

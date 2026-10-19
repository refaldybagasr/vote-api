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

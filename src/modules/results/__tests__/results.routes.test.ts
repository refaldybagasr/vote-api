import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { ManualClock } from '../../../lib/clock';
import { signAccessToken } from '../../../lib/jwt';
import { createAuthenticate } from '../../../middlewares/authenticate';
import { createTestUser } from '../../../test-utils/user-factory';
import { CandidateModel } from '../../candidates/candidate.model';
import { UserModel } from '../../users/user.model';
import { UserMongoRepository } from '../../users/user.repository';
import { VoteModel } from '../../votes/vote.model';
import { ResultsMongoRepository } from '../results.repository';
import { ResultsService } from '../results.service';
import { createResultsRouter } from '../results.routes';

const JWT_CONFIG_BASE = {
  secret: 'a-sufficiently-long-test-secret',
  issuer: 'vote-api',
  audience: 'vote-web',
};

function buildApp() {
  const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
  const jwtConfig = { ...JWT_CONFIG_BASE, clock };
  const userRepository = new UserMongoRepository();
  const resultsService = new ResultsService(new ResultsMongoRepository());

  const app = express();
  app.use(
    '/api/results',
    createResultsRouter({ resultsService, authenticate: createAuthenticate(userRepository, jwtConfig) }),
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

async function tokenFor(jwtConfig: ReturnType<typeof buildApp>['jwtConfig'], userId: string, role: string) {
  return signAccessToken({ sub: userId, role, tv: 0 }, 900, jwtConfig);
}

describe('GET /api/results', () => {
  it('returns 403 for a user role', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'plainuser' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');

    const res = await request(app).get('/api/results').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns correct per-candidate counts and totalVotes, including zero-vote candidates, sorted votes desc then name asc', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin', role: 'admin' });
    const token = await tokenFor(jwtConfig, admin._id.toString(), 'admin');
    const creator = new mongoose.Types.ObjectId();
    const amy = await CandidateModel.create({ displayName: 'Amy', normalizedName: 'amy', createdBy: creator });
    const zed = await CandidateModel.create({ displayName: 'Zed', normalizedName: 'zed', createdBy: creator });
    const max = await CandidateModel.create({ displayName: 'Max', normalizedName: 'max', createdBy: creator });
    await VoteModel.create({ userId: new mongoose.Types.ObjectId(), candidateId: amy._id });
    await VoteModel.create({ userId: new mongoose.Types.ObjectId(), candidateId: amy._id });
    await VoteModel.create({ userId: new mongoose.Types.ObjectId(), candidateId: zed._id });

    const res = await request(app).get('/api/results').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalVotes).toBe(3);
    expect(res.body.results).toEqual([
      { candidateId: amy._id.toString(), name: 'Amy', votes: 2, percentage: 66.7 },
      { candidateId: zed._id.toString(), name: 'Zed', votes: 1, percentage: 33.3 },
      { candidateId: max._id.toString(), name: 'Max', votes: 0, percentage: 0 },
    ]);
  });

  it('still counts votes from a soft-deleted voter', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin2', role: 'admin' });
    const token = await tokenFor(jwtConfig, admin._id.toString(), 'admin');
    const { user: voter } = await createTestUser({ username: 'softvoter' });
    const candidate = await CandidateModel.create({
      displayName: 'Candidate',
      normalizedName: 'candidate',
      createdBy: voter._id,
    });
    await VoteModel.create({ userId: voter._id, candidateId: candidate._id });
    await UserModel.updateOne({ _id: voter._id }, { $set: { deletedAt: new Date() } });

    const res = await request(app).get('/api/results').set('Authorization', `Bearer ${token}`);

    expect(res.body.results.find((r: { candidateId: string }) => r.candidateId === candidate._id.toString())?.votes).toBe(
      1,
    );
  });

  it('never includes any user id in the response', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin3', role: 'admin' });
    const token = await tokenFor(jwtConfig, admin._id.toString(), 'admin');
    const { user: voter } = await createTestUser({ username: 'voter' });
    const candidate = await CandidateModel.create({
      displayName: 'Nameless',
      normalizedName: 'nameless',
      createdBy: voter._id,
    });
    await VoteModel.create({ userId: voter._id, candidateId: candidate._id });

    const res = await request(app).get('/api/results').set('Authorization', `Bearer ${token}`);

    expect(JSON.stringify(res.body)).not.toContain(voter._id.toString());
  });
});

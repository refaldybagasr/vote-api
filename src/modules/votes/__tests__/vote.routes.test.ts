import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { ManualClock } from '../../../lib/clock';
import { signAccessToken } from '../../../lib/jwt';
import { createAuthenticate } from '../../../middlewares/authenticate';
import { createTestUser } from '../../../test-utils/user-factory';
import { UserMongoRepository } from '../../users/user.repository';
import { CandidateModel } from '../../candidates/candidate.model';
import { CandidateMongoRepository } from '../../candidates/candidate.repository';
import { MongooseTransactionManager } from '../../shared/transaction-manager';
import { VoteModel } from '../vote.model';
import { VoteMongoRepository } from '../vote.repository';
import { VoteService } from '../vote.service';
import { createVoteRouter } from '../vote.routes';

const JWT_CONFIG_BASE = {
  secret: 'a-sufficiently-long-test-secret',
  issuer: 'vote-api',
  audience: 'vote-web',
};

function buildApp() {
  const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
  const jwtConfig = { ...JWT_CONFIG_BASE, clock };
  const userRepository = new UserMongoRepository();
  const voteService = new VoteService({
    candidateRepository: new CandidateMongoRepository(),
    voteRepository: new VoteMongoRepository(),
    transactionManager: new MongooseTransactionManager(),
  });

  const app = express();
  app.use(express.json());
  app.use(
    '/api/votes',
    createVoteRouter({ voteService, authenticate: createAuthenticate(userRepository, jwtConfig) }),
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

  return { app, jwtConfig };
}

async function tokenFor(jwtConfig: ReturnType<typeof buildApp>['jwtConfig'], userId: string, role: string) {
  return signAccessToken({ sub: userId, role, tv: 0 }, 900, jwtConfig);
}

describe('POST /api/votes', () => {
  it('casts a vote for an existing candidate -> 201', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'voter1' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');
    const candidate = await CandidateModel.create({
      displayName: 'Existing',
      normalizedName: 'existing',
      createdBy: user._id,
    });

    const res = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${token}`)
      .send({ candidateId: candidate._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.candidateName).toBe('Existing');
  });

  it('casts a vote with a new name, creating the candidate -> 201', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'voter2' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');

    const res = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Totally New' });

    expect(res.status).toBe(201);
    expect(res.body.candidateName).toBe('Totally New');
    expect(await CandidateModel.countDocuments({ normalizedName: 'totally new' })).toBe(1);
  });

  it('reuses an existing candidate for an equivalent name (case, spacing, NFKC, zero-width)', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: creator } = await createTestUser({ username: 'creator' });
    await CandidateModel.create({ displayName: 'Budi Santoso', normalizedName: 'budi santoso', createdBy: creator._id });
    const { user } = await createTestUser({ username: 'voter3' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');

    const res = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '  BUDI​   Santoso ' });

    expect(res.status).toBe(201);
    expect(res.body.candidateName).toBe('Budi Santoso');
    expect(await CandidateModel.countDocuments({})).toBe(1);
  });

  it('returns 400 when both candidateId and name are given', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'voter4' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');

    const res = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${token}`)
      .send({ candidateId: new mongoose.Types.ObjectId().toString(), name: 'X' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when neither candidateId nor name is given', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'voter5' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');

    const res = await request(app).post('/api/votes').set('Authorization', `Bearer ${token}`).send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid candidateId', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'voter6' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');

    const res = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${token}`)
      .send({ candidateId: 'not-an-object-id' });

    expect(res.status).toBe(400);
  });

  it('returns 404 CANDIDATE_NOT_FOUND for an unknown candidateId', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'voter7' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');

    const res = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${token}`)
      .send({ candidateId: new mongoose.Types.ObjectId().toString() });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CANDIDATE_NOT_FOUND');
  });

  it.each(['', '   ', '08123', '<script>'])('returns 400 for a disallowed name "%s"', async (name) => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: `voter8${name.length}` });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');

    const res = await request(app).post('/api/votes').set('Authorization', `Bearer ${token}`).send({ name });

    expect(res.status).toBe(400);
  });

  it('returns 409 ALREADY_VOTED for a second vote for a different candidate', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'voter9' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');
    await request(app).post('/api/votes').set('Authorization', `Bearer ${token}`).send({ name: 'First' });

    const res = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Second' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_VOTED');
  });

  it('retrying with the same candidate or an equivalent name returns 200, total votes stays 1', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'voter10' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');
    await request(app).post('/api/votes').set('Authorization', `Bearer ${token}`).send({ name: 'Repeat Choice' });

    const res = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '  repeat   choice ' });

    expect(res.status).toBe(200);
    expect(await VoteModel.countDocuments({})).toBe(1);
  });

  it('a failed vote (already voted) with a new name does not create the candidate', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'voter11' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');
    await request(app).post('/api/votes').set('Authorization', `Bearer ${token}`).send({ name: 'Already Chosen' });

    const res = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Should Not Exist' });

    expect(res.status).toBe(409);
    expect(await CandidateModel.countDocuments({ normalizedName: 'should not exist' })).toBe(0);
  });

  it('rejects an admin with 403', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'adminvoter', role: 'admin' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'admin');

    const res = await request(app).post('/api/votes').set('Authorization', `Bearer ${token}`).send({ name: 'X' });

    expect(res.status).toBe(403);
  });

  it('10 parallel requests from the same user result in exactly one stored vote', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'voter12' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');
    const candidate = await CandidateModel.create({
      displayName: 'Concurrent',
      normalizedName: 'concurrent',
      createdBy: user._id,
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/votes')
          .set('Authorization', `Bearer ${token}`)
          .send({ candidateId: candidate._id.toString() }),
      ),
    );

    expect(await VoteModel.countDocuments({ userId: user._id })).toBe(1);
    expect(results.every((res) => res.status === 200 || res.status === 201)).toBe(true);
  });

  it('2 users submitting the same new name in parallel result in 1 candidate and 2 votes', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: userA } = await createTestUser({ username: 'parallelA' });
    const { user: userB } = await createTestUser({ username: 'parallelB' });
    const tokenA = await tokenFor(jwtConfig, userA._id.toString(), 'user');
    const tokenB = await tokenFor(jwtConfig, userB._id.toString(), 'user');

    const [resA, resB] = await Promise.all([
      request(app).post('/api/votes').set('Authorization', `Bearer ${tokenA}`).send({ name: 'Shared New Name' }),
      request(app).post('/api/votes').set('Authorization', `Bearer ${tokenB}`).send({ name: 'Shared New Name' }),
    ]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(await CandidateModel.countDocuments({ normalizedName: 'shared new name' })).toBe(1);
    expect(await VoteModel.countDocuments({})).toBe(2);
  });
});

describe('GET /api/votes/me', () => {
  it('returns hasVoted false before voting', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'meuser1' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');

    const res = await request(app).get('/api/votes/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasVoted: false, vote: null });
  });

  it('returns hasVoted true with the candidate name after voting', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'meuser2' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');
    await request(app).post('/api/votes').set('Authorization', `Bearer ${token}`).send({ name: 'My Choice' });

    const res = await request(app).get('/api/votes/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.hasVoted).toBe(true);
    expect(res.body.vote.candidateName).toBe('My Choice');
  });

  it('returns 401 with no token', async () => {
    const { app } = buildApp();

    const res = await request(app).get('/api/votes/me');

    expect(res.status).toBe(401);
  });
});

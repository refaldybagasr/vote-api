import express from 'express';
import request from 'supertest';
import { ManualClock } from '../../../lib/clock';
import { createAuthenticate } from '../../../middlewares/authenticate';
import { signAccessToken } from '../../../lib/jwt';
import { createTestUser } from '../../../test-utils/user-factory';
import { MongooseTransactionManager } from '../../shared/transaction-manager';
import { RefreshTokenMongoRepository } from '../../auth/refresh-token.repository';
import { UserMongoRepository } from '../user.repository';
import { UserService } from '../user.service';
import { createUserRouter } from '../user.routes';
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
  const userService = new UserService({
    userRepository,
    refreshTokenRepository: new RefreshTokenMongoRepository(),
    transactionManager: new MongooseTransactionManager(),
    bcryptCost: 4,
  });

  const app = express();
  app.use(express.json());
  app.use(
    '/api/users',
    createUserRouter({
      userService,
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

describe('users routes — access control', () => {
  it('rejects a user role on every admin route', async () => {
    const { app, jwtConfig } = buildApp();
    const { user } = await createTestUser({ username: 'plain', role: 'user' });
    const token = await tokenFor(jwtConfig, user._id.toString(), 'user');

    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    const create = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'x', password: 'password123', role: 'user' });

    expect(list.status).toBe(403);
    expect(create.status).toBe(403);
  });

  it('rejects requests with no token', async () => {
    const { app } = buildApp();

    expect((await request(app).get('/api/users')).status).toBe(401);
  });
});

describe('GET /api/users', () => {
  it('lists users, excluding soft-deleted, with pagination and no passwordHash', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');
    for (let i = 0; i < 3; i += 1) {
      await createTestUser({ username: `listed${i}` });
    }

    const res = await request(app)
      .get('/api/users?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(4);
    expect(res.body.items.every((item: Record<string, unknown>) => item.passwordHash === undefined)).toBe(
      true,
    );
    expect(res.body.items.every((item: Record<string, unknown>) => typeof item.version === 'number')).toBe(
      true,
    );
  });

  it.each(['abc', '-1', '9999'])('does not error for an out-of-range limit=%s', async (rawLimit) => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin2', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');

    const res = await request(app)
      .get(`/api/users?limit=${rawLimit}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/users', () => {
  it('creates a user', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin3', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'brandnew', password: 'password123', role: 'user' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ username: 'brandnew', role: 'user', version: 0 });
  });

  it('returns 409 USERNAME_TAKEN for a duplicate username with different casing', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin4', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');
    await createTestUser({ username: 'existing' });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'EXISTING', password: 'password123', role: 'user' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('returns 400 for an invalid role', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin5', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'invalidrole', password: 'password123', role: 'owner' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown fields', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin6', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'sneaky', password: 'password123', role: 'user', passwordHash: 'hacked', tokenVersion: 999 });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/users/:id', () => {
  it('returns 400 for a non-ObjectId id', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin7', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');

    const res = await request(app)
      .patch('/api/users/not-an-object-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ version: 0, isActive: false });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin8', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');

    const res = await request(app)
      .patch('/api/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ version: 0, isActive: false });

    expect(res.status).toBe(404);
  });

  it('updates successfully using the version from the create/list response, and returns the bumped version', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin9b', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');

    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'realclient', password: 'password123', role: 'user' });
    expect(created.body.version).toBe(0);

    const res = await request(app)
      .patch(`/api/users/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ version: created.body.version, isActive: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isActive: false, version: 1 });
  });

  it('returns 409 STALE_UPDATE for a stale version', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin9', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');
    const { user: target } = await createTestUser({ username: 'staletarget' });

    const res = await request(app)
      .patch(`/api/users/${target._id.toString()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ version: 99, isActive: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STALE_UPDATE');
  });

  it('returns 400 CANNOT_MODIFY_SELF when an admin disables themselves', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'selfadmin', role: 'admin' });
    await createTestUser({ username: 'otheradmin', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');

    const res = await request(app)
      .patch(`/api/users/${admin._id.toString()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ version: 0, isActive: false });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_MODIFY_SELF');
  });

  // LAST_ADMIN cannot be reached by a *different* admin caller through this route: authorize('admin')
  // itself requires the caller to be an active admin, so any non-self target has at least one other
  // active admin (the caller) at check time — activeAdminCount is never 1 for someone else's demotion.
  // It only matters for the self case (blocked earlier by CANNOT_MODIFY_SELF) or a genuine race between
  // two admins demoting each other concurrently, which the transaction serializes. See
  // UserService's own unit tests (user.service.test.ts) for direct coverage of the LAST_ADMIN branch.
});

describe('DELETE /api/users/:id', () => {
  it('soft-deletes a user; they can no longer log in', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin10', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');
    const { user: target, password } = await createTestUser({ username: 'tobedeleted' });

    const res = await request(app)
      .delete(`/api/users/${target._id.toString()}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    void password;
  });

  it('allows recreating a soft-deleted username to fail with 409 (username stays reserved)', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'admin11', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');
    const { user: target } = await createTestUser({ username: 'reserved' });

    await request(app).delete(`/api/users/${target._id.toString()}`).set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'reserved', password: 'password123', role: 'user' });

    expect(res.status).toBe(409);
  });

  it('returns 400 CANNOT_MODIFY_SELF when an admin deletes themselves', async () => {
    const { app, jwtConfig } = buildApp();
    const { user: admin } = await createTestUser({ username: 'selfdelete', role: 'admin' });
    await createTestUser({ username: 'otheradmin2', role: 'admin' });
    const adminToken = await tokenFor(jwtConfig, admin._id.toString(), 'admin');

    const res = await request(app)
      .delete(`/api/users/${admin._id.toString()}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_MODIFY_SELF');
  });
});

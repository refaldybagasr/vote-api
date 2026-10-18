import type http from 'http';
import request from 'supertest';
import { startServer } from '../server';

describe('startServer', () => {
  let server: http.Server;

  beforeAll(() => {
    process.env.PORT = '0';
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'a-sufficiently-long-dev-secret-value';
    process.env.JWT_ISSUER = 'vote-api';
    process.env.JWT_AUDIENCE = 'vote-web';
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    process.env.SEED_ADMIN_USERNAME = 'admin';
    process.env.SEED_ADMIN_PASSWORD = 'dev-only-admin-password';
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('connects to MongoDB, syncs indexes and serves a healthy /health', async () => {
    server = await startServer();

    const res = await request(server).get('/health');

    expect(res.status).toBe(200);
  });
});

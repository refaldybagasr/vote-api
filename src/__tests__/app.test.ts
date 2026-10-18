import request from 'supertest';
import { createApp } from '../app';
import { createLogger } from '../lib/logger';

const FRONTEND_ORIGIN = 'http://localhost:5173';

function buildApp(isDbHealthy: () => boolean = () => true) {
  return createApp({
    logger: createLogger('silent'),
    nodeEnv: 'test',
    frontendOrigin: FRONTEND_ORIGIN,
    trustProxy: false,
    isDbHealthy,
  });
}

describe('createApp', () => {
  it('sets trust proxy from deps', () => {
    expect(
      createApp({
        logger: createLogger('silent'),
        nodeEnv: 'test',
        frontendOrigin: FRONTEND_ORIGIN,
        trustProxy: true,
        isDbHealthy: () => true,
      }).get('trust proxy'),
    ).toBe(true);
    expect(buildApp().get('trust proxy')).toBe(false);
  });

  it('GET /health returns 200 when the DB is healthy', async () => {
    const app = buildApp(() => true);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
  });

  it('GET /health returns 503 when the DB is unhealthy', async () => {
    const app = buildApp(() => false);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
  });

  it('returns 404 JSON for an unknown route', async () => {
    const app = buildApp();

    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('returns 400 INVALID_JSON for a malformed JSON body', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'INVALID_JSON' } });
  });

  it('returns 413 PAYLOAD_TOO_LARGE for a body over 10kb', async () => {
    const app = buildApp();
    const oversizedPayload = JSON.stringify({ data: 'x'.repeat(11 * 1024) });

    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send(oversizedPayload);

    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
  });

  it('sets helmet security headers', async () => {
    const app = buildApp();

    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('reflects the exact allowed origin in CORS headers', async () => {
    const app = buildApp();

    const res = await request(app).get('/health').set('Origin', FRONTEND_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow a disallowed origin', async () => {
    const app = buildApp();

    const res = await request(app).get('/health').set('Origin', 'http://evil.example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

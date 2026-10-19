import type { Router } from 'express';
import request from 'supertest';
import { createApp } from '../../app';
import { buildContainer } from '../../container';
import { loadConfig } from '../../config/load-config';
import { createLogger } from '../../lib/logger';
import { generateOpenApiDocument } from '../generate-document';
import { countDocumentedRoutes, countRegisteredRoutes } from '../route-coverage';

function testConfig() {
  return loadConfig({
    MONGO_URI: 'mongodb://localhost:27017/voting?directConnection=true',
    JWT_ACCESS_SECRET: 'a-sufficiently-long-test-secret-value',
    JWT_ISSUER: 'vote-api',
    JWT_AUDIENCE: 'vote-web',
    FRONTEND_ORIGIN: 'http://localhost:5173',
    SEED_ADMIN_USERNAME: 'admin',
    SEED_ADMIN_PASSWORD: 'dev-only-admin-password',
  } as unknown as NodeJS.ProcessEnv);
}

async function buildRealApp() {
  const config = testConfig();
  const container = await buildContainer(config);
  return createApp({
    logger: createLogger('silent'),
    nodeEnv: config.NODE_ENV,
    frontendOrigin: config.FRONTEND_ORIGIN,
    trustProxy: config.TRUST_PROXY,
    isDbHealthy: () => true,
    authRouter: container.authRouter,
    usersRouter: container.usersRouter,
    candidatesRouter: container.candidatesRouter,
    votesRouter: container.votesRouter,
    resultsRouter: container.resultsRouter,
    docsRouter: container.docsRouter,
  });
}

describe('docs coverage (real app)', () => {
  it('GET /api/docs serves Swagger UI', async () => {
    const app = await buildRealApp();

    const res = await request(app).get('/api/docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('GET /api/docs/openapi.json returns a valid OpenAPI document', async () => {
    const app = await buildRealApp();

    const res = await request(app).get('/api/docs/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.components.securitySchemes.bearerAuth).toBeDefined();
    expect(res.body.components.securitySchemes.cookieAuth).toBeDefined();
  });

  it('every route registered through defineRoute appears in the generated OpenAPI document', async () => {
    const app = await buildRealApp();

    const res = await request(app).get('/api/docs/openapi.json');
    const paths = Object.keys(res.body.paths);

    const expectedPaths = [
      '/auth/login',
      '/auth/refresh',
      '/auth/logout',
      '/auth/me',
      '/users',
      '/users/{id}',
      '/candidates',
      '/votes',
      '/votes/me',
      '/results',
    ];

    for (const expectedPath of expectedPaths) {
      expect(paths).toContain(expectedPath);
    }
  });

  it('fails if a route was registered on a router without going through defineRoute', async () => {
    const container = await buildContainer(testConfig());
    const document = generateOpenApiDocument(container.openApiRegistry);

    const routers: [Router, string][] = [
      [container.authRouter, '/auth'],
      [container.usersRouter, '/users'],
      [container.candidatesRouter, '/candidates'],
      [container.votesRouter, '/votes'],
      [container.resultsRouter, '/results'],
    ];

    for (const [router, basePath] of routers) {
      expect(countRegisteredRoutes(router)).toBe(countDocumentedRoutes(document, basePath));
    }
  });
});

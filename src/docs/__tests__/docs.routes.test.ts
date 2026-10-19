import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { createOpenApiRegistry } from '../registry';
import { createRouteDefiner } from '../define-route';
import { createDocsRouter } from '../docs.routes';

function buildApp() {
  const registry = createOpenApiRegistry();
  const widgetsRouter = express.Router();
  const defineRoute = createRouteDefiner(widgetsRouter, registry, '/widgets');
  defineRoute({
    method: 'get',
    path: '/',
    summary: 'List widgets',
    tags: ['widgets'],
    auth: 'none',
    responses: [{ status: 200, description: 'OK', schema: z.array(z.object({ id: z.string() })) }],
    handlers: [(_req, res) => res.status(200).json([])],
  });

  const app = express();
  app.use('/api/docs', createDocsRouter(registry));
  return app;
}

describe('docs router', () => {
  it('GET /api/docs/openapi.json returns a valid OpenAPI document containing registered routes', async () => {
    const app = buildApp();

    const res = await request(app).get('/api/docs/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.paths['/widgets']).toBeDefined();
    expect(res.body.components.securitySchemes.bearerAuth).toBeDefined();
    expect(res.body.components.securitySchemes.cookieAuth).toBeDefined();
  });

  it('GET /api/docs serves Swagger UI', async () => {
    const app = buildApp();

    const res = await request(app).get('/api/docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});

import express from 'express';
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { createOpenApiRegistry } from '../registry';
import { createRouteDefiner } from '../define-route';
import { countDocumentedRoutes, countRegisteredRoutes } from '../route-coverage';

function generate(registry: ReturnType<typeof createOpenApiRegistry>) {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.0',
    info: { title: 'test', version: '1.0.0' },
  });
}

describe('route coverage', () => {
  it('counts match when every route goes through defineRoute', () => {
    const router = express.Router();
    const registry = createOpenApiRegistry();
    const defineRoute = createRouteDefiner(router, registry, '/widgets');

    defineRoute({
      method: 'get',
      path: '/',
      summary: 'List',
      tags: ['widgets'],
      auth: 'none',
      responses: [{ status: 200, description: 'OK' }],
      handlers: [(_req, res) => res.end()],
    });
    defineRoute({
      method: 'post',
      path: '/',
      summary: 'Create',
      tags: ['widgets'],
      auth: 'none',
      responses: [{ status: 201, description: 'Created' }],
      handlers: [(_req, res) => res.end()],
    });

    const document = generate(registry);

    expect(countRegisteredRoutes(router)).toBe(countDocumentedRoutes(document, '/widgets'));
  });

  it('detects a route registered directly on the router, bypassing defineRoute', () => {
    const router = express.Router();
    const registry = createOpenApiRegistry();
    const defineRoute = createRouteDefiner(router, registry, '/widgets');

    defineRoute({
      method: 'get',
      path: '/',
      summary: 'List',
      tags: ['widgets'],
      auth: 'none',
      responses: [{ status: 200, description: 'OK' }],
      handlers: [(_req, res) => res.end()],
    });
    router.post('/', (_req, res) => res.end());

    const document = generate(registry);

    expect(countRegisteredRoutes(router)).not.toBe(countDocumentedRoutes(document, '/widgets'));
  });
});

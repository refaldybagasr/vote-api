import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { createOpenApiRegistry } from '../registry';
import { createRouteDefiner } from '../define-route';
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

describe('defineRoute', () => {
  it('registers a working Express route and a matching OpenAPI path entry', () => {
    const router = express.Router();
    const registry = createOpenApiRegistry();
    const defineRoute = createRouteDefiner(router, registry, '/widgets');

    defineRoute({
      method: 'get',
      path: '/',
      summary: 'List widgets',
      tags: ['widgets'],
      auth: 'none',
      responses: [{ status: 200, description: 'OK', schema: z.array(z.object({ id: z.string() })) }],
      handlers: [(_req, res) => res.status(200).json([])],
    });

    const document = new OpenApiGeneratorV3(registry.definitions).generateDocument({
      openapi: '3.0.0',
      info: { title: 'test', version: '1.0.0' },
    });

    expect(document.paths?.['/widgets']?.get).toBeDefined();
  });

  it('converts Express :param syntax into OpenAPI {param} syntax', () => {
    const router = express.Router();
    const registry = createOpenApiRegistry();
    const defineRoute = createRouteDefiner(router, registry, '/widgets');

    defineRoute({
      method: 'get',
      path: '/:id',
      summary: 'Get a widget',
      tags: ['widgets'],
      auth: 'none',
      request: { params: z.object({ id: z.string() }) },
      responses: [{ status: 200, description: 'OK' }],
      handlers: [(_req, res) => res.status(200).json({})],
    });

    const document = new OpenApiGeneratorV3(registry.definitions).generateDocument({
      openapi: '3.0.0',
      info: { title: 'test', version: '1.0.0' },
    });

    expect(document.paths?.['/widgets/{id}']?.get).toBeDefined();
  });

  it('attaches the bearerAuth security requirement only when auth is "bearer"', () => {
    const router = express.Router();
    const registry = createOpenApiRegistry();
    const defineRoute = createRouteDefiner(router, registry, '/widgets');

    defineRoute({
      method: 'get',
      path: '/secure',
      summary: 'Secure',
      tags: ['widgets'],
      auth: 'bearer',
      responses: [{ status: 200, description: 'OK' }],
      handlers: [(_req, res) => res.status(200).json({})],
    });
    defineRoute({
      method: 'get',
      path: '/open',
      summary: 'Open',
      tags: ['widgets'],
      auth: 'none',
      responses: [{ status: 200, description: 'OK' }],
      handlers: [(_req, res) => res.status(200).json({})],
    });

    const document = new OpenApiGeneratorV3(registry.definitions).generateDocument({
      openapi: '3.0.0',
      info: { title: 'test', version: '1.0.0' },
    });

    expect(document.paths?.['/widgets/secure']?.get?.security).toEqual([{ bearerAuth: [] }]);
    expect(document.paths?.['/widgets/open']?.get?.security).toBeUndefined();
  });

  it('attaches request body and response examples to the generated document', () => {
    const router = express.Router();
    const registry = createOpenApiRegistry();
    const defineRoute = createRouteDefiner(router, registry, '/widgets');

    defineRoute({
      method: 'post',
      path: '/',
      summary: 'Create a widget',
      tags: ['widgets'],
      auth: 'none',
      request: {
        body: z.object({ name: z.string() }),
        bodyExample: { name: 'Example widget' },
      },
      responses: [
        {
          status: 201,
          description: 'Created',
          schema: z.object({ id: z.string() }),
          example: { id: 'abc123' },
        },
      ],
      handlers: [(_req, res) => res.status(201).json({})],
    });

    const document = new OpenApiGeneratorV3(registry.definitions).generateDocument({
      openapi: '3.0.0',
      info: { title: 'test', version: '1.0.0' },
    });

    const operation = document.paths?.['/widgets']?.post;
    const requestBody = operation?.requestBody as { content?: Record<string, { example?: unknown }> } | undefined;
    expect(requestBody?.content?.['application/json']?.example).toEqual({
      name: 'Example widget',
    });
    expect(operation?.responses?.[201]?.content?.['application/json']?.example).toEqual({
      id: 'abc123',
    });
  });

  it('the Express route it registers actually works', async () => {
    const router = express.Router();
    const registry = createOpenApiRegistry();
    const defineRoute = createRouteDefiner(router, registry, '/widgets');
    defineRoute({
      method: 'get',
      path: '/',
      summary: 'List widgets',
      tags: ['widgets'],
      auth: 'none',
      responses: [{ status: 200, description: 'OK' }],
      handlers: [(_req, res) => res.status(200).json([{ id: '1' }])],
    });
    const app = express();
    app.use('/widgets', router);

    const res = await request(app).get('/widgets');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: '1' }]);
  });
});

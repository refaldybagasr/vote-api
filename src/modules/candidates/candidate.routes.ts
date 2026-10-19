import { Router, type RequestHandler } from 'express';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { createRouteDefiner } from '../../docs/define-route';
import { candidateSchema, errorExample, errorResponseSchema } from '../../docs/common-schemas';
import { createListCandidatesHandler } from './candidate.controller';
import type { CandidateService } from './candidate.service';

export interface CandidateRouterDeps {
  candidateService: CandidateService;
  authenticate: RequestHandler;
  registry: OpenAPIRegistry;
}

export function createCandidateRouter(deps: CandidateRouterDeps): Router {
  const router = Router();
  const defineRoute = createRouteDefiner(router, deps.registry, '/candidates');

  defineRoute({
    method: 'get',
    path: '/',
    summary: 'List candidates sorted by name',
    tags: ['candidates'],
    auth: 'bearer',
    responses: [
      {
        status: 200,
        description: 'OK',
        schema: z.array(candidateSchema),
        example: [
          { id: '65f1a2b3c4d5e6f7a8b9c0d1', name: 'Ayu Lestari' },
          { id: '65f1a2b3c4d5e6f7a8b9c0d2', name: 'Budi Santoso' },
        ],
      },
      {
        status: 401,
        description: 'Unauthorized',
        schema: errorResponseSchema,
        example: errorExample('UNAUTHORIZED', 'Missing or invalid access token'),
      },
    ],
    handlers: [deps.authenticate, createListCandidatesHandler(deps.candidateService)],
  });

  return router;
}

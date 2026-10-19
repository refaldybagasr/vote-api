import { Router, type RequestHandler } from 'express';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { createRouteDefiner } from '../../docs/define-route';
import { errorExample, errorResponseSchema, resultsResponseSchema } from '../../docs/common-schemas';
import { authorize } from '../../middlewares/authorize';
import { createGetResultsHandler } from './results.controller';
import type { ResultsService } from './results.service';

export interface ResultsRouterDeps {
  resultsService: ResultsService;
  authenticate: RequestHandler;
  registry: OpenAPIRegistry;
}

export function createResultsRouter(deps: ResultsRouterDeps): Router {
  const router = Router();
  const defineRoute = createRouteDefiner(router, deps.registry, '/results');

  defineRoute({
    method: 'get',
    path: '/',
    summary: 'Get current vote totals and per-candidate percentages (admin only)',
    tags: ['results'],
    auth: 'bearer',
    responses: [
      {
        status: 200,
        description: 'OK',
        schema: resultsResponseSchema,
        example: {
          totalVotes: 2,
          results: [
            { candidateId: '65f1a2b3c4d5e6f7a8b9c0d1', name: 'Ayu Lestari', votes: 1, percentage: 50 },
            { candidateId: '65f1a2b3c4d5e6f7a8b9c0d2', name: 'Budi Santoso', votes: 1, percentage: 50 },
          ],
        },
      },
      {
        status: 401,
        description: 'Unauthorized',
        schema: errorResponseSchema,
        example: errorExample('UNAUTHORIZED', 'Missing or invalid access token'),
      },
      {
        status: 403,
        description: 'Forbidden',
        schema: errorResponseSchema,
        example: errorExample('FORBIDDEN', 'Admin role required'),
      },
    ],
    handlers: [deps.authenticate, authorize('admin'), createGetResultsHandler(deps.resultsService)],
  });

  return router;
}

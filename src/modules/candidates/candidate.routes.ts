import { Router, type RequestHandler } from 'express';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { createRouteDefiner } from '../../docs/define-route';
import { candidateSchema, errorExample, errorResponseSchema } from '../../docs/common-schemas';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { createAddCandidateHandler, createListCandidatesHandler } from './candidate.controller';
import { createCandidateSchema } from './create-candidate.schema';
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

  defineRoute({
    method: 'post',
    path: '/',
    summary: 'Create a candidate (admin only)',
    tags: ['candidates'],
    auth: 'bearer',
    request: { body: createCandidateSchema, bodyExample: { name: 'Ayu Lestari' } },
    responses: [
      {
        status: 201,
        description: 'Created',
        schema: candidateSchema,
        example: { id: '65f1a2b3c4d5e6f7a8b9c0d1', name: 'Ayu Lestari' },
      },
      {
        status: 400,
        description: 'Validation error',
        schema: errorResponseSchema,
        example: errorExample('VALIDATION_ERROR', 'Invalid candidate name'),
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
        example: errorExample('FORBIDDEN', 'Insufficient permissions'),
      },
      {
        status: 409,
        description: 'A candidate with this name already exists',
        schema: errorResponseSchema,
        example: errorExample('CANDIDATE_NAME_TAKEN', 'A candidate with this name already exists'),
      },
    ],
    handlers: [
      deps.authenticate,
      authorize('admin'),
      validate({ body: createCandidateSchema }),
      createAddCandidateHandler(deps.candidateService),
    ],
  });

  return router;
}

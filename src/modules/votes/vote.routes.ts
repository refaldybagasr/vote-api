import { Router, type RequestHandler } from 'express';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { createRouteDefiner } from '../../docs/define-route';
import { errorExample, errorResponseSchema, voteSchema, voteStatusSchema } from '../../docs/common-schemas';
import { validate } from '../../middlewares/validate';
import { createCastVoteHandler, createGetMyVoteHandler } from './vote.controller';
import { castVoteSchema } from './vote.schema';
import type { VoteService } from './vote.service';

export interface VoteRouterDeps {
  voteService: VoteService;
  authenticate: RequestHandler;
  registry: OpenAPIRegistry;
}

const voteExample = {
  candidateId: '65f1a2b3c4d5e6f7a8b9c0d1',
  candidateName: 'Ayu Lestari',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export function createVoteRouter(deps: VoteRouterDeps): Router {
  const router = Router();
  const defineRoute = createRouteDefiner(router, deps.registry, '/votes');

  router.use(deps.authenticate);

  defineRoute({
    method: 'post',
    path: '/',
    summary: 'Cast a vote for an existing candidate or a new name',
    tags: ['votes'],
    auth: 'bearer',
    request: { body: castVoteSchema, bodyExample: { candidateId: '65f1a2b3c4d5e6f7a8b9c0d1' } },
    responses: [
      { status: 201, description: 'Vote recorded', schema: voteSchema, example: voteExample },
      { status: 200, description: 'Idempotent retry of the same vote', schema: voteSchema, example: voteExample },
      {
        status: 400,
        description: 'Validation error',
        schema: errorResponseSchema,
        example: errorExample('VALIDATION_ERROR', 'Provide exactly one of candidateId or name'),
      },
      {
        status: 401,
        description: 'Unauthorized',
        schema: errorResponseSchema,
        example: errorExample('UNAUTHORIZED', 'Missing or invalid access token'),
      },
      {
        status: 403,
        description: 'Admins cannot vote',
        schema: errorResponseSchema,
        example: errorExample('FORBIDDEN', 'Admins cannot vote'),
      },
      {
        status: 404,
        description: 'Candidate not found',
        schema: errorResponseSchema,
        example: errorExample('CANDIDATE_NOT_FOUND', 'Candidate not found'),
      },
      {
        status: 409,
        description: 'Already voted for a different candidate',
        schema: errorResponseSchema,
        example: errorExample('ALREADY_VOTED', 'You have already voted for a different candidate'),
      },
    ],
    handlers: [validate({ body: castVoteSchema }), createCastVoteHandler(deps.voteService)],
  });

  defineRoute({
    method: 'get',
    path: '/me',
    summary: "Get the current user's vote status",
    tags: ['votes'],
    auth: 'bearer',
    responses: [
      {
        status: 200,
        description: 'OK',
        schema: voteStatusSchema,
        example: { hasVoted: true, vote: voteExample },
      },
      {
        status: 401,
        description: 'Unauthorized',
        schema: errorResponseSchema,
        example: errorExample('UNAUTHORIZED', 'Missing or invalid access token'),
      },
    ],
    handlers: [createGetMyVoteHandler(deps.voteService)],
  });

  return router;
}

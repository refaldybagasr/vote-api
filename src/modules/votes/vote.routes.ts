import { Router, type RequestHandler } from 'express';
import { validate } from '../../middlewares/validate';
import { createCastVoteHandler, createGetMyVoteHandler } from './vote.controller';
import { castVoteSchema } from './vote.schema';
import type { VoteService } from './vote.service';

export interface VoteRouterDeps {
  voteService: VoteService;
  authenticate: RequestHandler;
}

export function createVoteRouter(deps: VoteRouterDeps): Router {
  const router = Router();

  router.use(deps.authenticate);
  router.post('/', validate({ body: castVoteSchema }), createCastVoteHandler(deps.voteService));
  router.get('/me', createGetMyVoteHandler(deps.voteService));

  return router;
}

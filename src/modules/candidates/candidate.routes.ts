import { Router, type RequestHandler } from 'express';
import { createListCandidatesHandler } from './candidate.controller';
import type { CandidateService } from './candidate.service';

export interface CandidateRouterDeps {
  candidateService: CandidateService;
  authenticate: RequestHandler;
}

export function createCandidateRouter(deps: CandidateRouterDeps): Router {
  const router = Router();

  router.get('/', deps.authenticate, createListCandidatesHandler(deps.candidateService));

  return router;
}

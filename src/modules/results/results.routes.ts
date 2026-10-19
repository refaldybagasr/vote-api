import { Router, type RequestHandler } from 'express';
import { authorize } from '../../middlewares/authorize';
import { createGetResultsHandler } from './results.controller';
import type { ResultsService } from './results.service';

export interface ResultsRouterDeps {
  resultsService: ResultsService;
  authenticate: RequestHandler;
}

export function createResultsRouter(deps: ResultsRouterDeps): Router {
  const router = Router();

  router.get('/', deps.authenticate, authorize('admin'), createGetResultsHandler(deps.resultsService));

  return router;
}

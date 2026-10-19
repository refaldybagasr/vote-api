import type { NextFunction, Request, Response } from 'express';
import type { CandidateService } from './candidate.service';

export function createListCandidatesHandler(service: CandidateService) {
  return async function listCandidates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const candidates = await service.list();
      res.status(200).json(candidates);
    } catch (error) {
      next(error);
    }
  };
}

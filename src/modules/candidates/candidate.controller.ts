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

export function createAddCandidateHandler(service: CandidateService) {
  return async function addCandidate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body as { name: string };
      const auth = req.auth;
      if (!auth) {
        throw new Error('authenticate middleware did not attach req.auth');
      }
      const candidate = await service.create(name, auth.id);
      res.status(201).json(candidate);
    } catch (error) {
      next(error);
    }
  };
}

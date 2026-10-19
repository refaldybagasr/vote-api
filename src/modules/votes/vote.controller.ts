import type { NextFunction, Request, Response } from 'express';
import type { VoteService } from './vote.service';

export function createCastVoteHandler(service: VoteService) {
  return async function castVote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { candidateId, name } = req.body as { candidateId?: string; name?: string };
      const auth = req.auth;
      if (!auth) {
        throw new Error('authenticate middleware did not attach req.auth');
      }
      const result = await service.castVote({
        userId: auth.id,
        role: auth.role,
        ...(candidateId !== undefined ? { candidateId } : {}),
        ...(name !== undefined ? { name } : {}),
      });
      res.status(result.status).json(result.vote);
    } catch (error) {
      next(error);
    }
  };
}

export function createGetMyVoteHandler(service: VoteService) {
  return async function getMyVote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth;
      if (!auth) {
        throw new Error('authenticate middleware did not attach req.auth');
      }
      const result = await service.getMyVote(auth.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

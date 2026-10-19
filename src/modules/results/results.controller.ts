import type { NextFunction, Request, Response } from 'express';
import type { ResultsService } from './results.service';

export function createGetResultsHandler(service: ResultsService) {
  return async function getResults(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.get();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';

export function authorize(...roles: string[]) {
  return function authorizeMiddleware(req: Request, _res: Response, next: NextFunction): void {
    if (!req.auth || !roles.includes(req.auth.role)) {
      next(new AppError('FORBIDDEN', 403, 'Insufficient permissions'));
      return;
    }
    next();
  };
}

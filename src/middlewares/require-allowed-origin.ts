import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';

export function requireAllowedOrigin(frontendOrigin: string) {
  return function requireAllowedOriginMiddleware(req: Request, _res: Response, next: NextFunction): void {
    if (req.headers.origin !== frontendOrigin) {
      next(new AppError('ORIGIN_NOT_ALLOWED', 403, 'Origin not allowed'));
      return;
    }
    next();
  };
}

import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { AppError } from '../lib/errors';

export interface ValidateSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validate(schemas: ValidateSchemas) {
  return function validateMiddleware(req: Request, _res: Response, next: NextFunction): void {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as Request['params'];
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as Request['query'];
      }
      next();
    } catch (error) {
      next(new AppError('VALIDATION_ERROR', 400, formatZodError(error)));
    }
  };
}

function formatZodError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  }
  return 'Invalid request';
}

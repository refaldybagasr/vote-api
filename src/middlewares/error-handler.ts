import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import { AppError } from '../lib/errors';

type ErrorBody = { error: { code: string; message: string; stack?: string } };

function hasType(err: unknown, type: string): boolean {
  return typeof err === 'object' && err !== null && (err as { type?: unknown }).type === type;
}

export function createErrorHandler(logger: Logger, nodeEnv: string) {
  return function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      return;
    }

    if (hasType(err, 'entity.parse.failed')) {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
      return;
    }

    if (hasType(err, 'entity.too.large')) {
      res
        .status(413)
        .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } });
      return;
    }

    logger.error({ err }, 'Unhandled error');

    const body: ErrorBody = {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
    if (nodeEnv !== 'production' && err instanceof Error && err.stack !== undefined) {
      body.error.stack = err.stack;
    }
    res.status(500).json(body);
  };
}

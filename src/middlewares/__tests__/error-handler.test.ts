import type { Request, Response } from 'express';
import { createLogger } from '../../lib/logger';
import { AppError } from '../../lib/errors';
import { createErrorHandler } from '../error-handler';

function fakeResponse() {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = jest.fn().mockImplementation((body: unknown) => {
    res.body = body;
    return res as Response;
  });
  return res as Response & { statusCode?: number; body?: unknown };
}

describe('createErrorHandler', () => {
  const silentLogger = createLogger('silent');

  it('maps an AppError to its own status code and code', () => {
    const handler = createErrorHandler(silentLogger, 'test');
    const res = fakeResponse();

    handler(new AppError('ALREADY_VOTED', 409, 'You already voted'), {} as Request, res, jest.fn());

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: { code: 'ALREADY_VOTED', message: 'You already voted' } });
  });

  it('maps a malformed-JSON body-parser error to 400 INVALID_JSON', () => {
    const handler = createErrorHandler(silentLogger, 'test');
    const res = fakeResponse();
    const parseError = Object.assign(new Error('Unexpected token'), { type: 'entity.parse.failed' });

    handler(parseError, {} as Request, res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'INVALID_JSON' } });
  });

  it('maps an oversized-payload body-parser error to 413 PAYLOAD_TOO_LARGE', () => {
    const handler = createErrorHandler(silentLogger, 'test');
    const res = fakeResponse();
    const tooLargeError = Object.assign(new Error('too large'), { type: 'entity.too.large' });

    handler(tooLargeError, {} as Request, res, jest.fn());

    expect(res.statusCode).toBe(413);
    expect(res.body).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
  });

  it('maps an unexpected error to 500 INTERNAL_ERROR without a stack trace in production', () => {
    const handler = createErrorHandler(silentLogger, 'production');
    const res = fakeResponse();

    handler(new Error('boom'), {} as Request, res, jest.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  });

  it('includes the stack trace for an unexpected error outside production', () => {
    const handler = createErrorHandler(silentLogger, 'development');
    const res = fakeResponse();

    handler(new Error('boom'), {} as Request, res, jest.fn());

    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { stack?: string } }).error.stack).toContain('boom');
  });
});

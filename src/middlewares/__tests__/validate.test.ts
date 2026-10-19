import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../lib/errors';
import { validate } from '../validate';

function fakeReqRes(body: unknown) {
  const req = { body, params: {}, query: {} } as unknown as Request;
  const res = {} as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next: next as jest.Mock };
}

describe('validate', () => {
  const schema = z.object({ username: z.string().min(1) }).strict();

  it('replaces req.body with the parsed value on success', () => {
    const { req, res, next } = fakeReqRes({ username: 'admin' });

    validate({ body: schema })(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ username: 'admin' });
  });

  it('forwards a 400 VALIDATION_ERROR when the body is invalid', () => {
    const { req, res, next } = fakeReqRes({ username: '' });

    validate({ body: schema })(req, res, next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
  });

  it('forwards a 400 VALIDATION_ERROR when the body has unknown fields', () => {
    const { req, res, next } = fakeReqRes({ username: 'admin', extra: 'nope' });

    validate({ body: schema })(req, res, next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-string value where a string is required (NoSQL-injection shaped payload)', () => {
    const { req, res, next } = fakeReqRes({ username: { $ne: null } });

    validate({ body: schema })(req, res, next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

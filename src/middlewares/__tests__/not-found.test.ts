import type { Request, Response } from 'express';
import { AppError } from '../../lib/errors';
import { notFound } from '../not-found';

describe('notFound', () => {
  it('forwards a 404 AppError to the next error handler', () => {
    const next = jest.fn();

    notFound({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
  });
});

import type { NextFunction, Request, Response } from 'express';
import { authorize } from '../authorize';

function fakeReqRes(auth: Request['auth']) {
  const req = { auth } as Request;
  const res = {} as Response;
  const next = jest.fn();
  return { req, res, next };
}

describe('authorize', () => {
  it('calls next with no error when the role matches', () => {
    const { req, res, next } = fakeReqRes({ id: '1', username: 'a', role: 'admin' });

    authorize('admin')(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with no error when any of multiple allowed roles matches', () => {
    const { req, res, next } = fakeReqRes({ id: '1', username: 'a', role: 'user' });

    authorize('admin', 'user')(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it('forwards a 403 FORBIDDEN error when the role does not match', () => {
    const { req, res, next } = fakeReqRes({ id: '1', username: 'a', role: 'user' });

    authorize('admin')(req, res, next as unknown as NextFunction);

    const error = next.mock.calls[0][0];
    expect(error.code).toBe('FORBIDDEN');
    expect(error.statusCode).toBe(403);
  });

  it('forwards a 403 FORBIDDEN error when req.auth is missing', () => {
    const { req, res, next } = fakeReqRes(undefined);

    authorize('admin')(req, res, next as unknown as NextFunction);

    expect(next.mock.calls[0][0].code).toBe('FORBIDDEN');
  });
});

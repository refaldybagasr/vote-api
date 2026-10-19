import type { NextFunction, Request, Response } from 'express';
import { requireAllowedOrigin } from '../require-allowed-origin';

function fakeReqRes(origin: string | undefined) {
  const req = { headers: { origin } } as unknown as Request;
  const res = {} as Response;
  const next = jest.fn();
  return { req, res, next };
}

describe('requireAllowedOrigin', () => {
  const middleware = requireAllowedOrigin('http://localhost:5173');

  it('calls next with no error when the Origin header matches exactly', () => {
    const { req, res, next } = fakeReqRes('http://localhost:5173');

    middleware(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it('forwards a 403 ORIGIN_NOT_ALLOWED error when the Origin header does not match', () => {
    const { req, res, next } = fakeReqRes('http://evil.example.com');

    middleware(req, res, next as unknown as NextFunction);

    const error = next.mock.calls[0][0];
    expect(error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(error.statusCode).toBe(403);
  });

  it('forwards a 403 ORIGIN_NOT_ALLOWED error when the Origin header is missing', () => {
    const { req, res, next } = fakeReqRes(undefined);

    middleware(req, res, next as unknown as NextFunction);

    expect(next.mock.calls[0][0].code).toBe('ORIGIN_NOT_ALLOWED');
  });
});

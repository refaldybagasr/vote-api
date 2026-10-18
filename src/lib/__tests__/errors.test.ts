import { AppError } from '../errors';

describe('AppError', () => {
  it('carries a code, HTTP status and message', () => {
    const error = new AppError('NOT_FOUND', 404, 'Route not found');

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Route not found');
  });
});

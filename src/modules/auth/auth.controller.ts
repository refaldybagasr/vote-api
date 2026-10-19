import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../lib/errors';
import type { JwtConfig } from '../../lib/jwt';
import { verifyAccessToken } from '../../lib/jwt';
import type { AuthService } from './auth.service';

export function createLoginHandler(authService: AuthService) {
  return async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body as { username: string; password: string };
      const result = await authService.login(username, password);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

export function createMeHandler(authService: AuthService, jwtConfig: JwtConfig) {
  return async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) {
        throw new AppError('UNAUTHORIZED', 401, 'Missing bearer token');
      }
      const claims = verifyAccessToken(token, jwtConfig);
      const user = await authService.getById(claims.sub);
      res.status(200).json(user);
    } catch {
      next(new AppError('UNAUTHORIZED', 401, 'Invalid or missing token'));
    }
  };
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token;
}

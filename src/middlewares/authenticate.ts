import type { NextFunction, Request, Response } from 'express';
import { extractBearerToken } from '../lib/bearer-token';
import { AppError } from '../lib/errors';
import type { JwtConfig } from '../lib/jwt';
import { verifyAccessToken } from '../lib/jwt';
import type { UserRepository } from '../modules/users/user.repository';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthenticatedUser;
  }
}

const UNAUTHORIZED = new AppError('UNAUTHORIZED', 401, 'Invalid or expired session');

export function createAuthenticate(userRepository: UserRepository, jwtConfig: JwtConfig) {
  return async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) {
        throw UNAUTHORIZED;
      }

      const claims = verifyAccessToken(token, jwtConfig);
      const user = await userRepository.findById(claims.sub);

      if (!user || !user.isActive || user.deletedAt || user.tokenVersion !== claims.tv) {
        throw UNAUTHORIZED;
      }

      req.auth = { id: user.id, username: user.username, role: user.role };
      next();
    } catch {
      next(UNAUTHORIZED);
    }
  };
}

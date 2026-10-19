import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../lib/errors';
import type { AuthService } from './auth.service';

export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/auth';

export interface CookieOptions {
  secure: boolean;
  maxAgeMs: number;
}

function setRefreshCookie(res: Response, token: string, options: CookieOptions): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    secure: options.secure,
    maxAge: options.maxAgeMs,
  });
}

export function createLoginHandler(authService: AuthService, cookieOptions: CookieOptions) {
  return async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body as { username: string; password: string };
      const { accessToken, refreshToken, user } = await authService.login(username, password);
      setRefreshCookie(res, refreshToken, cookieOptions);
      res.status(200).json({ accessToken, user });
    } catch (error) {
      next(error);
    }
  };
}

export function createRefreshHandler(authService: AuthService, cookieOptions: CookieOptions) {
  return async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
      if (!token) {
        throw new AppError('UNAUTHORIZED', 401, 'Missing refresh token');
      }
      const { accessToken, refreshToken, user } = await authService.refresh(token);
      setRefreshCookie(res, refreshToken, cookieOptions);
      res.status(200).json({ accessToken, user });
    } catch (error) {
      next(error);
    }
  };
}

export function createLogoutHandler(authService: AuthService) {
  return async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
      await authService.logout(token);
      res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

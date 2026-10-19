import type { NextFunction, Request, Response } from 'express';
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

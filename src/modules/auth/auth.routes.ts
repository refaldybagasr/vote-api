import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import type { JwtConfig } from '../../lib/jwt';
import { validate } from '../../middlewares/validate';
import type { AuthService } from './auth.service';
import { createLoginHandler, createMeHandler } from './auth.controller';
import { loginSchema } from './login.schema';

export interface AuthRouterDeps {
  authService: AuthService;
  jwtConfig: JwtConfig;
  rateLimitMax: number;
  rateLimitWindowMs: number;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  const loginRateLimiter = rateLimit({
    windowMs: deps.rateLimitWindowMs,
    limit: deps.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const username = typeof req.body?.username === 'string' ? req.body.username : '';
      return `${ipKeyGenerator(req.ip ?? 'unknown')}:${username}`;
    },
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many login attempts' } });
    },
  });

  router.post('/login', loginRateLimiter, validate({ body: loginSchema }), createLoginHandler(deps.authService));
  router.get('/me', createMeHandler(deps.authService, deps.jwtConfig));

  return router;
}

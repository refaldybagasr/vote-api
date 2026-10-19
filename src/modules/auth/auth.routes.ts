import { Router, type RequestHandler } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { createRouteDefiner } from '../../docs/define-route';
import {
  authResultSchema,
  errorExample,
  errorResponseSchema,
  publicUserSchema,
} from '../../docs/common-schemas';
import { validate } from '../../middlewares/validate';
import type { AuthService } from './auth.service';
import {
  createLoginHandler,
  createLogoutHandler,
  createRefreshHandler,
  type CookieOptions,
} from './auth.controller';
import { loginSchema } from './login.schema';

export interface AuthRouterDeps {
  authService: AuthService;
  authenticate: RequestHandler;
  requireAllowedOrigin: RequestHandler;
  cookieOptions: CookieOptions;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  registry: OpenAPIRegistry;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();
  const defineRoute = createRouteDefiner(router, deps.registry, '/auth');

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

  defineRoute({
    method: 'post',
    path: '/login',
    summary: 'Log in with username and password',
    tags: ['auth'],
    auth: 'none',
    request: {
      body: loginSchema,
      bodyExample: { username: 'jane_doe', password: 'hunter22' },
    },
    responses: [
      {
        status: 200,
        description: 'Logged in',
        schema: authResultSchema,
        example: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: { id: '65f1a2b3c4d5e6f7a8b9c0d1', username: 'jane_doe', role: 'user' },
        },
      },
      {
        status: 400,
        description: 'Validation error',
        schema: errorResponseSchema,
        example: errorExample('VALIDATION_ERROR', 'username is required'),
      },
      {
        status: 401,
        description: 'Invalid credentials',
        schema: errorResponseSchema,
        example: errorExample('INVALID_CREDENTIALS', 'Invalid username or password'),
      },
      {
        status: 429,
        description: 'Too many attempts',
        schema: errorResponseSchema,
        example: errorExample('RATE_LIMITED', 'Too many login attempts'),
      },
    ],
    handlers: [
      loginRateLimiter,
      validate({ body: loginSchema }),
      createLoginHandler(deps.authService, deps.cookieOptions),
    ],
  });

  defineRoute({
    method: 'post',
    path: '/refresh',
    summary: 'Rotate the refresh token and issue a new access token',
    tags: ['auth'],
    auth: 'cookie',
    responses: [
      {
        status: 200,
        description: 'Refreshed',
        schema: authResultSchema,
        example: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: { id: '65f1a2b3c4d5e6f7a8b9c0d1', username: 'jane_doe', role: 'user' },
        },
      },
      {
        status: 401,
        description: 'Invalid or expired refresh token',
        schema: errorResponseSchema,
        example: errorExample('TOKEN_EXPIRED', 'Refresh token expired or revoked'),
      },
      {
        status: 403,
        description: 'Origin not allowed',
        schema: errorResponseSchema,
        example: errorExample('ORIGIN_NOT_ALLOWED', 'Origin header not allowed'),
      },
    ],
    handlers: [deps.requireAllowedOrigin, createRefreshHandler(deps.authService, deps.cookieOptions)],
  });

  defineRoute({
    method: 'post',
    path: '/logout',
    summary: 'Revoke the refresh token and clear the cookie (idempotent)',
    tags: ['auth'],
    auth: 'none',
    responses: [
      { status: 204, description: 'Logged out' },
      {
        status: 403,
        description: 'Origin not allowed',
        schema: errorResponseSchema,
        example: errorExample('ORIGIN_NOT_ALLOWED', 'Origin header not allowed'),
      },
    ],
    handlers: [deps.requireAllowedOrigin, createLogoutHandler(deps.authService)],
  });

  defineRoute({
    method: 'get',
    path: '/me',
    summary: 'Get the current authenticated user',
    tags: ['auth'],
    auth: 'bearer',
    responses: [
      {
        status: 200,
        description: 'Current user',
        schema: publicUserSchema,
        example: { id: '65f1a2b3c4d5e6f7a8b9c0d1', username: 'jane_doe', role: 'user' },
      },
      {
        status: 401,
        description: 'Unauthorized',
        schema: errorResponseSchema,
        example: errorExample('UNAUTHORIZED', 'Missing or invalid access token'),
      },
    ],
    handlers: [
      deps.authenticate,
      (req, res) => {
        res.status(200).json(req.auth);
      },
    ],
  });

  return router;
}

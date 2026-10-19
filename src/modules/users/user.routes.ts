import { Router, type RequestHandler } from 'express';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { createRouteDefiner } from '../../docs/define-route';
import {
  errorExample,
  errorResponseSchema,
  userListItemSchema,
  userListResponseSchema,
} from '../../docs/common-schemas';
import { idParamSchema } from '../../lib/schemas/object-id-param.schema';
import { validate } from '../../middlewares/validate';
import { authorize } from '../../middlewares/authorize';
import { createUserSchema } from './create-user.schema';
import { updateUserSchema } from './update-user.schema';
import {
  createCreateUserHandler,
  createDeleteUserHandler,
  createListUsersHandler,
  createUpdateUserHandler,
} from './user.controller';
import type { UserService } from './user.service';

export interface UserRouterDeps {
  userService: UserService;
  authenticate: RequestHandler;
  registry: OpenAPIRegistry;
}

const listUsersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

const EXAMPLE_USER_ID = '65f1a2b3c4d5e6f7a8b9c0d1';

const createdUserExample = {
  id: EXAMPLE_USER_ID,
  username: 'jane_doe',
  role: 'user',
  isActive: true,
  hasVoted: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export function createUserRouter(deps: UserRouterDeps): Router {
  const router = Router();
  const defineRoute = createRouteDefiner(router, deps.registry, '/users');

  router.use(deps.authenticate, authorize('admin'));

  defineRoute({
    method: 'get',
    path: '/',
    summary: 'List users (admin only, paginated)',
    tags: ['users'],
    auth: 'bearer',
    request: { query: listUsersQuerySchema },
    responses: [
      {
        status: 200,
        description: 'OK',
        schema: userListResponseSchema,
        example: { items: [createdUserExample], page: 1, limit: 20, total: 1 },
      },
      {
        status: 401,
        description: 'Unauthorized',
        schema: errorResponseSchema,
        example: errorExample('UNAUTHORIZED', 'Missing or invalid access token'),
      },
      {
        status: 403,
        description: 'Forbidden',
        schema: errorResponseSchema,
        example: errorExample('FORBIDDEN', 'Admin role required'),
      },
    ],
    handlers: [createListUsersHandler(deps.userService)],
  });

  defineRoute({
    method: 'post',
    path: '/',
    summary: 'Create a user (admin only)',
    tags: ['users'],
    auth: 'bearer',
    request: {
      body: createUserSchema,
      bodyExample: { username: 'jane_doe', password: 'hunter2222', role: 'user' },
    },
    responses: [
      { status: 201, description: 'Created', schema: userListItemSchema, example: createdUserExample },
      {
        status: 400,
        description: 'Validation error',
        schema: errorResponseSchema,
        example: errorExample('VALIDATION_ERROR', 'password must be at least 8 characters'),
      },
      {
        status: 401,
        description: 'Unauthorized',
        schema: errorResponseSchema,
        example: errorExample('UNAUTHORIZED', 'Missing or invalid access token'),
      },
      {
        status: 403,
        description: 'Forbidden',
        schema: errorResponseSchema,
        example: errorExample('FORBIDDEN', 'Admin role required'),
      },
      {
        status: 409,
        description: 'Username already taken',
        schema: errorResponseSchema,
        example: errorExample('USERNAME_TAKEN', 'Username is already taken'),
      },
    ],
    handlers: [validate({ body: createUserSchema }), createCreateUserHandler(deps.userService)],
  });

  defineRoute({
    method: 'patch',
    path: '/:id',
    summary: 'Update a user (admin only; password, role, isActive)',
    tags: ['users'],
    auth: 'bearer',
    request: {
      params: idParamSchema,
      body: updateUserSchema,
      bodyExample: { version: 0, isActive: false },
    },
    responses: [
      { status: 200, description: 'Updated', schema: userListItemSchema, example: createdUserExample },
      {
        status: 400,
        description: 'Validation error / CANNOT_MODIFY_SELF / LAST_ADMIN',
        schema: errorResponseSchema,
        example: errorExample('CANNOT_MODIFY_SELF', 'Admins cannot modify their own account'),
      },
      {
        status: 401,
        description: 'Unauthorized',
        schema: errorResponseSchema,
        example: errorExample('UNAUTHORIZED', 'Missing or invalid access token'),
      },
      {
        status: 403,
        description: 'Forbidden',
        schema: errorResponseSchema,
        example: errorExample('FORBIDDEN', 'Admin role required'),
      },
      {
        status: 404,
        description: 'Not found',
        schema: errorResponseSchema,
        example: errorExample('NOT_FOUND', 'User not found'),
      },
      {
        status: 409,
        description: 'Stale version',
        schema: errorResponseSchema,
        example: errorExample('STALE_UPDATE', 'User was modified by another request'),
      },
    ],
    handlers: [
      validate({ params: idParamSchema, body: updateUserSchema }),
      createUpdateUserHandler(deps.userService),
    ],
  });

  defineRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Soft-delete a user (admin only)',
    tags: ['users'],
    auth: 'bearer',
    request: { params: idParamSchema },
    responses: [
      { status: 204, description: 'Deleted' },
      {
        status: 400,
        description: 'CANNOT_MODIFY_SELF / LAST_ADMIN',
        schema: errorResponseSchema,
        example: errorExample('LAST_ADMIN', 'Cannot remove the last active admin'),
      },
      {
        status: 401,
        description: 'Unauthorized',
        schema: errorResponseSchema,
        example: errorExample('UNAUTHORIZED', 'Missing or invalid access token'),
      },
      {
        status: 403,
        description: 'Forbidden',
        schema: errorResponseSchema,
        example: errorExample('FORBIDDEN', 'Admin role required'),
      },
      {
        status: 404,
        description: 'Not found',
        schema: errorResponseSchema,
        example: errorExample('NOT_FOUND', 'User not found'),
      },
    ],
    handlers: [validate({ params: idParamSchema }), createDeleteUserHandler(deps.userService)],
  });

  return router;
}

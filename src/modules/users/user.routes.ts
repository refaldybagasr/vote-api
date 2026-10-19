import { Router, type RequestHandler } from 'express';
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
}

export function createUserRouter(deps: UserRouterDeps): Router {
  const router = Router();

  router.use(deps.authenticate, authorize('admin'));

  router.get('/', createListUsersHandler(deps.userService));
  router.post('/', validate({ body: createUserSchema }), createCreateUserHandler(deps.userService));
  router.patch(
    '/:id',
    validate({ params: idParamSchema, body: updateUserSchema }),
    createUpdateUserHandler(deps.userService),
  );
  router.delete('/:id', validate({ params: idParamSchema }), createDeleteUserHandler(deps.userService));

  return router;
}

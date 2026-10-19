import type { NextFunction, Request, Response } from 'express';
import { parseListUsersQuery } from './list-users-query';
import type { UserService } from './user.service';

export function createListUsersHandler(service: UserService) {
  return async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = parseListUsersQuery(req.query);
      const result = await service.list({ page, limit });
      res.status(200).json({ items: result.items, page, limit, total: result.total });
    } catch (error) {
      next(error);
    }
  };
}

export function createCreateUserHandler(service: UserService) {
  return async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await service.create(req.body);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  };
}

export function createUpdateUserHandler(service: UserService) {
  return async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { version, ...rest } = req.body as { version: number } & Record<string, unknown>;
      const requesterId = req.auth?.id ?? '';
      const user = await service.update(req.params.id as string, version, rest, requesterId);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  };
}

export function createDeleteUserHandler(service: UserService) {
  return async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requesterId = req.auth?.id ?? '';
      await service.softDelete(req.params.id as string, requesterId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

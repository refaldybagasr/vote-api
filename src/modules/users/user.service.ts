import { AppError, DuplicateKeyError } from '../../lib/errors';
import { isDuplicateKeyError, toDuplicateKeyError } from '../../lib/mongo-errors';
import { hashPassword, PasswordTooLongError } from '../../lib/password';
import type { RefreshTokenRepository } from '../auth/refresh-token.repository';
import type { TransactionManager, TxContext } from '../shared/transaction-manager';
import type { UserRole } from './user.model';
import type { UpdateUserChanges, UserRecord, UserRepository } from './user.repository';

export interface PublicUserListItem {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  hasVoted: boolean;
  createdAt: Date;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserServiceDeps {
  userRepository: UserRepository;
  refreshTokenRepository: RefreshTokenRepository;
  transactionManager: TransactionManager;
  bcryptCost: number;
  /** Stubbed until issue #28 introduces the Vote model; see PR notes. */
  hasVotedLookup?: (userIds: string[]) => Promise<Set<string>>;
}

const NOT_FOUND = new AppError('NOT_FOUND', 404, 'User not found');
const STALE_UPDATE = new AppError('STALE_UPDATE', 409, 'User was modified by someone else');
const CANNOT_MODIFY_SELF = new AppError('CANNOT_MODIFY_SELF', 400, 'You cannot modify your own account this way');
const LAST_ADMIN = new AppError('LAST_ADMIN', 400, 'Cannot modify the last active admin');

export class UserService {
  constructor(private readonly deps: UserServiceDeps) {}

  async list(page: { page: number; limit: number }): Promise<{ items: PublicUserListItem[]; total: number }> {
    const { items, total } = await this.deps.userRepository.list(page);
    const hasVotedLookup = this.deps.hasVotedLookup ?? (async () => new Set<string>());
    const votedIds = await hasVotedLookup(items.map((item) => item.id));

    return {
      items: items.map((item) => toListItem(item, votedIds.has(item.id))),
      total,
    };
  }

  async create(request: CreateUserRequest): Promise<PublicUserListItem> {
    let passwordHash: string;
    try {
      passwordHash = await hashPassword(request.password, this.deps.bcryptCost);
    } catch (error) {
      if (error instanceof PasswordTooLongError) {
        throw new AppError('VALIDATION_ERROR', 400, error.message);
      }
      throw error;
    }

    try {
      const created = await this.deps.userRepository.create({
        username: request.username.toLowerCase(),
        passwordHash,
        role: request.role,
      });
      return toListItem(created, false);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const duplicate: DuplicateKeyError = toDuplicateKeyError(error);
        throw new AppError('USERNAME_TAKEN', 409, `${duplicate.field} is already taken`);
      }
      throw error;
    }
  }

  async update(
    id: string,
    expectedVersion: number,
    request: UpdateUserRequest,
    requesterId: string,
  ): Promise<PublicUserListItem> {
    const target = await this.deps.userRepository.findById(id);
    if (!target || target.deletedAt) {
      throw NOT_FOUND;
    }

    this.assertCanModify(target, requesterId, request);

    return this.deps.transactionManager.run(async (ctx) => {
      if (request.isActive === false || (request.role !== undefined && request.role !== 'admin')) {
        await this.assertNotLastActiveAdmin(target, ctx);
      }

      let passwordHash: string | undefined;
      if (request.password !== undefined) {
        try {
          passwordHash = await hashPassword(request.password, this.deps.bcryptCost);
        } catch (error) {
          if (error instanceof PasswordTooLongError) {
            throw new AppError('VALIDATION_ERROR', 400, error.message);
          }
          throw error;
        }
      }

      const changes: UpdateUserChanges = {};
      if (passwordHash !== undefined) {
        changes.passwordHash = passwordHash;
      }
      if (request.role !== undefined) {
        changes.role = request.role;
      }
      if (request.isActive !== undefined) {
        changes.isActive = request.isActive;
      }

      const updated = await this.deps.userRepository.update(id, expectedVersion, changes, ctx);
      if (!updated) {
        throw STALE_UPDATE;
      }

      await this.deps.refreshTokenRepository.revokeAllForUser(updated.id, ctx);

      return toListItem(updated, false);
    });
  }

  async softDelete(id: string, requesterId: string): Promise<void> {
    const target = await this.deps.userRepository.findById(id);
    if (!target || target.deletedAt) {
      throw NOT_FOUND;
    }

    this.assertCanModify(target, requesterId, { isActive: false });

    await this.deps.transactionManager.run(async (ctx) => {
      await this.assertNotLastActiveAdmin(target, ctx);

      const deleted = await this.deps.userRepository.softDelete(id, ctx);
      if (!deleted) {
        throw NOT_FOUND;
      }
      await this.deps.refreshTokenRepository.revokeAllForUser(id, ctx);
    });
  }

  private assertCanModify(target: UserRecord, requesterId: string, request: UpdateUserRequest): void {
    if (target.id !== requesterId) {
      return;
    }
    if (request.isActive === false) {
      throw CANNOT_MODIFY_SELF;
    }
    if (request.role !== undefined && request.role !== 'admin') {
      throw CANNOT_MODIFY_SELF;
    }
  }

  private async assertNotLastActiveAdmin(target: UserRecord, ctx: TxContext): Promise<void> {
    if (target.role !== 'admin' || !target.isActive) {
      return;
    }
    const activeAdminCount = await this.deps.userRepository.countActiveAdmins(ctx);
    if (activeAdminCount <= 1) {
      throw LAST_ADMIN;
    }
  }
}

function toListItem(user: UserRecord, hasVoted: boolean): PublicUserListItem {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    hasVoted,
    createdAt: user.createdAt,
  };
}

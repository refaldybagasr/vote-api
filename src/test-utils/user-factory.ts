import { hashPassword } from '../lib/password';
import { UserModel, type UserRole } from '../modules/users/user.model';

export interface CreateTestUserOptions {
  username?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  deletedAt?: Date | null;
}

let counter = 0;

export async function createTestUser(options: CreateTestUserOptions = {}) {
  counter += 1;
  const username = options.username ?? `user${counter}`;
  const password = options.password ?? 'dev-only-password';
  const passwordHash = await hashPassword(password, 4);

  const user = await UserModel.create({
    username: username.toLowerCase(),
    passwordHash,
    role: options.role ?? 'user',
    isActive: options.isActive ?? true,
    deletedAt: options.deletedAt ?? null,
  });

  return { user, password };
}

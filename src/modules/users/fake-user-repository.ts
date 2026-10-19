import type {
  CreateUserInput,
  ListUsersResult,
  UpdateUserChanges,
  UserRecord,
  UserRepository,
} from './user.repository';

export class FakeUserRepository implements UserRepository {
  private counter = 0;

  constructor(private readonly users: UserRecord[] = []) {}

  async findByUsername(username: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.username === username.toLowerCase()) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async incrementTokenVersion(id: string): Promise<void> {
    const user = this.users.find((candidate) => candidate.id === id);
    if (user) {
      user.tokenVersion += 1;
    }
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const username = input.username.toLowerCase();
    if (this.users.some((user) => user.username === username)) {
      throw Object.assign(new Error('duplicate key'), { code: 11000, keyPattern: { username: 1 } });
    }

    this.counter += 1;
    const record: UserRecord = {
      id: `fake-${this.counter}`,
      username: input.username.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      isActive: true,
      deletedAt: null,
      tokenVersion: 0,
      version: 0,
      createdAt: new Date(),
    };
    this.users.push(record);
    return record;
  }

  async list({ page, limit }: { page: number; limit: number }): Promise<ListUsersResult> {
    const visible = this.users.filter((user) => user.deletedAt === null);
    const start = (page - 1) * limit;
    return { items: visible.slice(start, start + limit), total: visible.length };
  }

  async update(id: string, expectedVersion: number, changes: UpdateUserChanges): Promise<UserRecord | null> {
    const user = this.users.find((candidate) => candidate.id === id);
    if (!user || user.version !== expectedVersion) {
      return null;
    }
    if (changes.passwordHash !== undefined) {
      user.passwordHash = changes.passwordHash;
    }
    if (changes.role !== undefined) {
      user.role = changes.role;
    }
    if (changes.isActive !== undefined) {
      user.isActive = changes.isActive;
    }
    user.version += 1;
    user.tokenVersion += 1;
    return { ...user };
  }

  async softDelete(id: string): Promise<boolean> {
    const user = this.users.find((candidate) => candidate.id === id);
    if (!user || user.deletedAt !== null) {
      return false;
    }
    user.deletedAt = new Date();
    user.tokenVersion += 1;
    return true;
  }

  async countActiveAdmins(): Promise<number> {
    return this.users.filter((user) => user.role === 'admin' && user.isActive && user.deletedAt === null)
      .length;
  }
}

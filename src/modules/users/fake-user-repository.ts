import type { UserRecord, UserRepository } from './user.repository';

export class FakeUserRepository implements UserRepository {
  constructor(private readonly users: UserRecord[] = []) {}

  async findByUsername(username: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.username === username.toLowerCase()) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }
}

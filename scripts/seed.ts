import mongoose from 'mongoose';
import { bootstrapConfig } from '../src/config/bootstrap';
import { configureMongoose } from '../src/lib/configure-mongoose';
import { createLogger } from '../src/lib/logger';
import { hashPassword } from '../src/lib/password';
import { syncAllIndexes } from '../src/lib/sync-indexes';
import type { UserRole } from '../src/modules/users/user.model';
import { UserMongoRepository, type UserRepository } from '../src/modules/users/user.repository';

export interface SeedConfig {
  SEED_ADMIN_USERNAME: string;
  SEED_ADMIN_PASSWORD: string;
  SEED_DEMO_USERS: string;
  BCRYPT_COST: number;
}

export interface SeedResult {
  adminCreated: boolean;
  demoUsersCreated: string[];
  demoUsersSkipped: string[];
}

export function parseDemoUsers(raw: string): { username: string; password: string }[] {
  return raw
    .split(',')
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const separatorIndex = pair.indexOf(':');
      if (separatorIndex === -1) {
        return { username: pair.trim(), password: '' };
      }
      return {
        username: pair.slice(0, separatorIndex).trim(),
        password: pair.slice(separatorIndex + 1).trim(),
      };
    })
    .filter((entry) => entry.username.length > 0 && entry.password.length > 0);
}

async function seedOneUser(
  userRepository: UserRepository,
  username: string,
  password: string,
  role: UserRole,
  bcryptCost: number,
): Promise<boolean> {
  const existing = await userRepository.findByUsername(username);
  if (existing) {
    return false;
  }

  const passwordHash = await hashPassword(password, bcryptCost);
  await userRepository.create({ username: username.toLowerCase(), passwordHash, role });
  return true;
}

export async function seedUsers(userRepository: UserRepository, config: SeedConfig): Promise<SeedResult> {
  const adminCreated = await seedOneUser(
    userRepository,
    config.SEED_ADMIN_USERNAME,
    config.SEED_ADMIN_PASSWORD,
    'admin',
    config.BCRYPT_COST,
  );

  const demoUsersCreated: string[] = [];
  const demoUsersSkipped: string[] = [];

  for (const demoUser of parseDemoUsers(config.SEED_DEMO_USERS)) {
    const created = await seedOneUser(userRepository, demoUser.username, demoUser.password, 'user', config.BCRYPT_COST);
    (created ? demoUsersCreated : demoUsersSkipped).push(demoUser.username);
  }

  return { adminCreated, demoUsersCreated, demoUsersSkipped };
}

/* istanbul ignore next */
async function main(): Promise<void> {
  const config = bootstrapConfig();
  const logger = createLogger(config.LOG_LEVEL);

  configureMongoose();
  await mongoose.connect(config.MONGO_URI);
  await syncAllIndexes();

  const result = await seedUsers(new UserMongoRepository(), config);
  logger.info(result, 'seed complete');

  await mongoose.disconnect();
}

/* istanbul ignore next */
if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}

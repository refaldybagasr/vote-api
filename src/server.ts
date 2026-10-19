import 'dotenv/config';
import type { Server } from 'http';
import mongoose from 'mongoose';
import { createApp } from './app';
import { bootstrapConfig } from './config/bootstrap';
import { buildContainer } from './container';
import { configureMongoose } from './lib/configure-mongoose';
import { createGracefulShutdown } from './lib/graceful-shutdown';
import { createLogger } from './lib/logger';
import { syncAllIndexes } from './lib/sync-indexes';

export async function startServer(): Promise<Server> {
  const config = bootstrapConfig();
  const logger = createLogger(config.LOG_LEVEL);

  configureMongoose();
  await mongoose.connect(config.MONGO_URI);
  await syncAllIndexes();

  const container = await buildContainer(config);

  const app = createApp({
    logger,
    nodeEnv: config.NODE_ENV,
    frontendOrigin: config.FRONTEND_ORIGIN,
    trustProxy: config.TRUST_PROXY,
    isDbHealthy: () => mongoose.connection.readyState === 1,
    authRouter: container.authRouter,
    usersRouter: container.usersRouter,
    candidatesRouter: container.candidatesRouter,
    votesRouter: container.votesRouter,
  });

  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'vote-api listening');
  });

  const shutdown = createGracefulShutdown({
    server,
    logger,
    onShutdown: () => mongoose.disconnect(),
  });

  /* istanbul ignore next */
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  /* istanbul ignore next */
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return server;
}

/* istanbul ignore next */
if (require.main === module) {
  startServer().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}

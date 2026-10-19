import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type Router } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { createErrorHandler } from './middlewares/error-handler';
import { notFound } from './middlewares/not-found';

export interface AppDeps {
  logger: Logger;
  nodeEnv: string;
  frontendOrigin: string;
  trustProxy: boolean;
  isDbHealthy: () => boolean;
  authRouter?: Router;
}

export function createApp(deps: AppDeps): Express {
  const app = express();

  app.set('trust proxy', deps.trustProxy);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, !origin || origin === deps.frontendOrigin);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    const healthy = deps.isDbHealthy();
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'unavailable' });
  });

  if (deps.authRouter) {
    app.use('/api/auth', deps.authRouter);
  }

  app.use(notFound);
  app.use(createErrorHandler(deps.logger, deps.nodeEnv));

  return app;
}

import type { Server } from 'http';
import type { Logger } from 'pino';

export interface GracefulShutdownDeps {
  server: Pick<Server, 'close'>;
  onShutdown: () => Promise<void>;
  logger: Logger;
}

export function createGracefulShutdown(deps: GracefulShutdownDeps) {
  return function shutdown(signal: string): Promise<void> {
    deps.logger.info({ signal }, 'Shutting down');
    return new Promise<void>((resolve, reject) => {
      deps.server.close(() => {
        deps.onShutdown().then(resolve, reject);
      });
    });
  };
}

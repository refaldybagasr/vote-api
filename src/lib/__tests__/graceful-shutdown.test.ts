import { createGracefulShutdown } from '../graceful-shutdown';
import { createLogger } from '../logger';

function fakeServer() {
  return {
    close: jest.fn().mockImplementation((cb: () => void) => cb()),
  };
}

describe('createGracefulShutdown', () => {
  it('stops the HTTP server before running the shutdown callback', async () => {
    const server = fakeServer();
    const order: string[] = [];
    server.close.mockImplementation((cb: () => void) => {
      order.push('server-closed');
      cb();
    });
    const onShutdown = jest.fn().mockImplementation(async () => {
      order.push('on-shutdown');
    });

    const shutdown = createGracefulShutdown({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server: server as any,
      onShutdown,
      logger: createLogger('silent'),
    });

    await shutdown('SIGTERM');

    expect(order).toEqual(['server-closed', 'on-shutdown']);
  });

  it('still runs the shutdown callback if the server has no in-flight connections', async () => {
    const server = fakeServer();
    const onShutdown = jest.fn().mockResolvedValue(undefined);

    const shutdown = createGracefulShutdown({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server: server as any,
      onShutdown,
      logger: createLogger('silent'),
    });

    await shutdown('SIGINT');

    expect(onShutdown).toHaveBeenCalledTimes(1);
  });
});

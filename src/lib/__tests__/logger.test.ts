import { Writable } from 'stream';
import { createLogger } from '../logger';

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = createLogger('info', stream);
  return { logger, lines };
}

describe('createLogger', () => {
  it('redacts sensitive fields', () => {
    const { logger, lines } = captureLogger();

    logger.info({
      password: 'super-secret',
      accessToken: 'token-value',
      refreshToken: 'refresh-value',
      req: { headers: { authorization: 'Bearer abc', cookie: 'refresh_token=abc' } },
    });

    const logged = lines.join('');
    expect(logged).not.toContain('super-secret');
    expect(logged).not.toContain('token-value');
    expect(logged).not.toContain('refresh-value');
    expect(logged).not.toContain('Bearer abc');
    expect(logged).not.toContain('refresh_token=abc');
    expect(logged).toContain('[REDACTED]');
  });

  it('logs non-sensitive fields as-is', () => {
    const { logger, lines } = captureLogger();

    logger.info({ event: 'scaffold ready' });

    expect(lines.join('')).toContain('scaffold ready');
  });
});

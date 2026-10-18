import pino, { type Logger } from 'pino';
import type { Writable } from 'stream';

export function createLogger(level: string, destination?: Writable): Logger {
  return pino(
    {
      level,
      redact: {
        paths: [
          'password',
          'accessToken',
          'refreshToken',
          '*.password',
          '*.accessToken',
          '*.refreshToken',
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      },
    },
    destination,
  );
}

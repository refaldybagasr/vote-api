import { loadConfig } from '../load-config';
import { DEV_PLACEHOLDER_JWT_SECRET } from '../schema';

function validEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const base: Record<string, string> = {
    NODE_ENV: 'development',
    MONGO_URI: 'mongodb://localhost:27017/voting?directConnection=true',
    JWT_ACCESS_SECRET: 'a-sufficiently-long-dev-secret-value',
    JWT_ISSUER: 'vote-api',
    JWT_AUDIENCE: 'vote-web',
    FRONTEND_ORIGIN: 'http://localhost:5173',
    SEED_ADMIN_USERNAME: 'admin',
    SEED_ADMIN_PASSWORD: 'dev-only-admin-password',
  };

  const merged: Record<string, string> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return merged as unknown as NodeJS.ProcessEnv;
}

describe('loadConfig', () => {
  it('returns a valid config with sensible defaults applied', () => {
    const config = loadConfig(validEnv());

    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
    expect(config.MONGO_PORT).toBe(27017);
    expect(config.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(config.COOKIE_SECURE).toBe(false);
    expect(config.DOCS_ENABLED).toBe(true);
    expect(config.LOG_LEVEL).toBe('info');
  });

  it.each(['MONGO_URI', 'JWT_ACCESS_SECRET', 'FRONTEND_ORIGIN', 'SEED_ADMIN_USERNAME'])(
    'throws naming %s when it is missing',
    (missingKey) => {
      expect(() => loadConfig(validEnv({ [missingKey]: undefined }))).toThrow(
        new RegExp(missingKey),
      );
    },
  );

  it('coerces numeric env vars to numbers', () => {
    const config = loadConfig(validEnv({ PORT: '4000', BCRYPT_COST: '12' }));

    expect(config.PORT).toBe(4000);
    expect(config.BCRYPT_COST).toBe(12);
  });

  it.each([
    ['true', true],
    ['false', false],
    ['TRUE', true],
    ['FALSE', false],
  ])('parses COOKIE_SECURE=%s as boolean %s', (raw, expected) => {
    const config = loadConfig(validEnv({ COOKIE_SECURE: raw }));

    expect(config.COOKIE_SECURE).toBe(expected);
  });

  it('refuses to start in production with the dev placeholder secret', () => {
    expect(() =>
      loadConfig(
        validEnv({ NODE_ENV: 'production', JWT_ACCESS_SECRET: DEV_PLACEHOLDER_JWT_SECRET }),
      ),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('refuses to start in production with a secret shorter than 32 characters', () => {
    expect(() =>
      loadConfig(validEnv({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'too-short' })),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('starts normally in production with a strong, non-placeholder secret', () => {
    const strongSecret = 'x'.repeat(32);

    expect(() =>
      loadConfig(validEnv({ NODE_ENV: 'production', JWT_ACCESS_SECRET: strongSecret })),
    ).not.toThrow();
  });
});

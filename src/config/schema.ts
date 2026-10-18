import { z } from 'zod';

export const DEV_PLACEHOLDER_JWT_SECRET = 'dev-only-placeholder-change-me-please-32chars';
const MIN_PRODUCTION_SECRET_LENGTH = 32;

const booleanFromString = z.preprocess(
  (value) => (typeof value === 'string' ? value.toLowerCase() === 'true' : value),
  z.boolean(),
);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(0).default(3000),

    MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
    MONGO_PORT: z.coerce.number().int().positive().default(27017),

    JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
    JWT_ISSUER: z.string().min(1, 'JWT_ISSUER is required'),
    JWT_AUDIENCE: z.string().min(1, 'JWT_AUDIENCE is required'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

    COOKIE_SECURE: booleanFromString.default(false),
    FRONTEND_ORIGIN: z.string().min(1, 'FRONTEND_ORIGIN is required'),
    TRUST_PROXY: booleanFromString.default(false),

    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),

    BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(10),

    DOCS_ENABLED: booleanFromString.default(true),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    SEED_ADMIN_USERNAME: z.string().min(1, 'SEED_ADMIN_USERNAME is required'),
    SEED_ADMIN_PASSWORD: z.string().min(1, 'SEED_ADMIN_PASSWORD is required'),
    SEED_DEMO_USERS: z.string().default(''),
  })
  .superRefine((config, ctx) => {
    if (config.NODE_ENV !== 'production') {
      return;
    }

    if (config.JWT_ACCESS_SECRET === DEV_PLACEHOLDER_JWT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT_ACCESS_SECRET must not be the dev placeholder value in production',
      });
      return;
    }

    if (config.JWT_ACCESS_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message: `JWT_ACCESS_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

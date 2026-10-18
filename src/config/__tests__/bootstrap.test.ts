import { bootstrapConfig } from '../bootstrap';

describe('bootstrapConfig', () => {
  it('returns the config when the environment is valid', () => {
    const env = {
      NODE_ENV: 'development',
      MONGO_URI: 'mongodb://localhost:27017/voting?directConnection=true',
      JWT_ACCESS_SECRET: 'a-sufficiently-long-dev-secret-value',
      JWT_ISSUER: 'vote-api',
      JWT_AUDIENCE: 'vote-web',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      SEED_ADMIN_USERNAME: 'admin',
      SEED_ADMIN_PASSWORD: 'dev-only-admin-password',
    } as unknown as NodeJS.ProcessEnv;

    expect(bootstrapConfig(env)).toMatchObject({ NODE_ENV: 'development' });
  });

  it('writes the error to stderr and exits with code 1 on invalid environment', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    bootstrapConfig({} as NodeJS.ProcessEnv);

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('MONGO_URI'));

    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});

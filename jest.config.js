/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['/node_modules/'],
  globalSetup: '<rootDir>/src/test-utils/global-setup.ts',
  globalTeardown: '<rootDir>/src/test-utils/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup-env.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/test-utils/global-setup.ts',
    '!src/test-utils/global-teardown.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};

// Backend test runner. Two projects:
//   unit — pure rule functions, no IO (test/unit/**/*.spec.ts)
//   e2e  — the real AppModule over supertest against the local docker
//          Postgres (DB taktic_test on :5433) and Redis (db index 1 on
//          :6380). See test/README.md.
// Transpile-only (isolatedModules in test/tsconfig.json); `pnpm typecheck:test` does the type pass.
const tsJest = ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }];

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      rootDir: __dirname,
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
      transform: { '^.+\\.ts$': tsJest },
    },
    {
      displayName: 'e2e',
      rootDir: __dirname,
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
      transform: { '^.+\\.ts$': tsJest },
      setupFiles: ['<rootDir>/test/env.ts'],
      globalSetup: '<rootDir>/test/global-setup.ts',
      setupFilesAfterEnv: ['<rootDir>/test/setup-e2e.ts'],
    },
  ],
};

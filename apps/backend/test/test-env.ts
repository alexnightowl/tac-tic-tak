/**
 * Single source of truth for the e2e environment. Imported by the jest
 * setupFiles (env.ts), the globalSetup and the helpers, so every piece
 * agrees on which database / Redis index is the disposable one.
 *
 * Overridable with TEST_DATABASE_URL / TEST_REDIS_URL, but the guards
 * below refuse anything that is not clearly a local test target: the
 * owner's dev DB `taktic` (and prod) must never be truncated.
 */
import { APP_CONFIG_ENV_KEYS } from '../src/app-config/app-config';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://taktic:taktic@localhost:5433/taktic_test?schema=public';
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6380/1';
export const TEST_JWT_SECRET = 'e2e-test-secret-not-for-prod';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function assertSafeTestTargets(dbUrl = TEST_DATABASE_URL, redisUrl = TEST_REDIS_URL) {
  const db = new URL(dbUrl);
  const dbName = db.pathname.replace(/^\//, '');
  if (!LOCAL_HOSTS.has(db.hostname)) {
    throw new Error(`[e2e] refusing to run against non-local Postgres host "${db.hostname}"`);
  }
  if (!/_test$/.test(dbName)) {
    throw new Error(`[e2e] refusing to run against database "${dbName}": name must end in _test`);
  }
  const r = new URL(redisUrl);
  const index = Number(r.pathname.replace(/^\//, '') || '0');
  if (!LOCAL_HOSTS.has(r.hostname)) {
    throw new Error(`[e2e] refusing to run against non-local Redis host "${r.hostname}"`);
  }
  if (!Number.isInteger(index) || index < 1) {
    throw new Error(`[e2e] refusing Redis db index ${index}: tests need a dedicated index >= 1 (dev uses 0)`);
  }
}

/** Puts the test targets into process.env before any app module is imported. */
export function applyTestEnv() {
  assertSafeTestTargets();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.REDIS_URL = TEST_REDIS_URL;
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  // The golden test asserts the code/compose default (7d); an inherited
  // shell value must not mask a regression of that default.
  delete process.env.JWT_EXPIRES_IN;
  // B3 app-config comes from env; specs set what they need, nothing leaks in from the shell.
  for (const key of APP_CONFIG_ENV_KEYS) delete process.env[key];
  // B11: specs run under the default rate limits unless they set THROTTLE_* themselves.
  for (const key of Object.keys(process.env)) if (key.startsWith('THROTTLE_')) delete process.env[key];
}

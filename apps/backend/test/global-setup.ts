import { execFileSync } from 'child_process';
import { join } from 'path';
import { assertSafeTestTargets, TEST_DATABASE_URL } from './test-env';

/**
 * Once per e2e run: bring the disposable test DB up to the current
 * migrations with `prisma migrate deploy` (exactly what prod runs on
 * container start), never `migrate dev`.
 */
export default async function globalSetup() {
  assertSafeTestTargets();
  const backendDir = join(__dirname, '..');
  const prismaBin = join(backendDir, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
  execFileSync(
    prismaBin,
    ['migrate', 'deploy'],
    {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: process.env.E2E_VERBOSE ? 'inherit' : 'pipe',
    },
  );
}

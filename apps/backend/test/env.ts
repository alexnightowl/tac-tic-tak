// jest `setupFiles` for the e2e project: runs in every test file before
// any import, so AuthModule/JwtStrategy/Prisma/Redis read test values.
import { applyTestEnv } from './test-env';

applyTestEnv();

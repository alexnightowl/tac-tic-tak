import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type Probe = 'up' | 'down';

const PROBE_TIMEOUT_MS = 2000;

/** Resolves 'up' if the check settles OK within the timeout, else 'down'. Never throws. */
async function probe(check: () => Promise<unknown>): Promise<Probe> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<Probe>((resolve) => {
    timer = setTimeout(() => resolve('down'), PROBE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([check().then((): Probe => 'up', (): Probe => 'down'), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/health and /api/v1/health (B2). Public, no auth, exempt from
 * the min-build gate. 200 `{status:'ok', db:'up', redis:'up'}` when
 * Postgres and Redis both answer within 2 s; otherwise 503 with the same
 * keys and `status:'error'`, so a deploy check can tell which one is down.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async check() {
    const [db, redis] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      probe(() => this.redis.client.ping()),
    ]);
    const body = { status: db === 'up' && redis === 'up' ? 'ok' : 'error', db, redis };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }
}

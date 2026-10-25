import { ExecutionContext, Logger, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { createHash } from 'crypto';
import { AuthModule } from '../auth/auth.module';
import { AppThrottlerGuard, AppThrottlerOptions } from './app-throttler.guard';
import { clientIp } from './client-ip';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { GLOBAL_THROTTLE, resolveThrottleRules, throttleEnabled, ThrottleKeyBy, ThrottleName } from './throttle.config';

type Req = Parameters<typeof clientIp>[0] & { body?: unknown };

@Module({
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
class ThrottleStorageModule {}

const log = new Logger('Throttle');
let warnedNoIp = false;

function ipTracker(req: Req): string {
  const ip = clientIp(req);
  if (ip) return `ip:${ip}`;
  if (!warnedNoIp) {
    warnedNoIp = true;
    log.warn("X-Forwarded-For present but 'trust proxy' is off: per-IP limits are skipped until it is set (B2)");
  }
  return '';
}

/** `user:<sub>` for a valid bearer token, else the client IP. */
function userOrIpTracker(jwt: JwtService, req: Req): string {
  const auth = req.headers?.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify<{ sub?: unknown }>(auth.slice(7).trim());
      if (typeof payload.sub === 'string' && payload.sub) return `user:${payload.sub}`;
    } catch {
      // invalid or expired: treat as anonymous (the route's auth guard answers 401)
    }
  }
  return ipTracker(req);
}

function nicknameTracker(req: Req): string {
  const body = req.body as { nickname?: unknown } | undefined;
  const nick = typeof body?.nickname === 'string' ? body.nickname.trim().toLowerCase().slice(0, 64) : '';
  return nick ? `nick:${nick}` : '';
}

function routeOptsIn(ctx: ExecutionContext, name: ThrottleName): boolean {
  const names: string[] | undefined = Reflect.getMetadata(RATE_LIMIT_KEY, ctx.getHandler());
  return !!names?.includes(name);
}

/**
 * B11 rate limiting: @nestjs/throttler on Redis, registered as a global
 * guard. Limits and keys live in throttle.config.ts.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ThrottleStorageModule, AuthModule],
      inject: [RedisThrottlerStorage, JwtService],
      useFactory: (storage: RedisThrottlerStorage, jwt: JwtService) => {
        const rules = resolveThrottleRules();
        const trackers: Record<ThrottleKeyBy, (req: Req) => string> = {
          'user-or-ip': (req) => userOrIpTracker(jwt, req),
          ip: ipTracker,
          nickname: nicknameTracker,
        };
        const throttlers: AppThrottlerOptions[] = throttleEnabled()
          ? (Object.entries(rules) as [ThrottleName, (typeof rules)[ThrottleName]][]).map(([name, rule]) => ({
              name,
              limit: rule.limit,
              ttl: rule.ttlSec * 1000,
              refund: rule.refund,
              getTracker: (req) => trackers[rule.keyBy](req as Req),
              // One counter per (throttler, client): `global` is shared by every route.
              generateKey: (_ctx, tracker, n) => `throttle:${n}:${createHash('sha256').update(tracker).digest('hex').slice(0, 32)}`,
              skipIf: name === GLOBAL_THROTTLE ? undefined : (ctx) => !routeOptsIn(ctx, name),
            }))
          : [];
        return { throttlers, storage, setHeaders: false };
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class ThrottleModule {}

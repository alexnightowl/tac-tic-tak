import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerOptions, ThrottlerRequest } from '@nestjs/throttler';
import type { ThrottleRule } from './throttle.config';

export type AppThrottlerOptions = ThrottlerOptions & { refund?: ThrottleRule['refund'] };

type Refundable = { refund?: (key: string) => Promise<void> };
type ResLike = { header(name: string, value: string): void; once(ev: 'finish', cb: () => void): void; statusCode: number };

/**
 * ThrottlerGuard with the app's conventions:
 * - an empty tracker means "no usable key" (e.g. the client IP is unknown
 *   behind an untrusted proxy) and skips that throttler for the request;
 * - no X-RateLimit-* headers on normal responses (the web's responses stay
 *   byte-identical); a 429 carries a plain `Retry-After: <seconds>` and the
 *   Nest error shape plus an additive `retryAfter` (seconds) in the body;
 * - optional per-throttler refunds once the response has finished.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(p: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl, blockDuration, getTracker, generateKey } = p;
    const throttler = p.throttler as AppThrottlerOptions;
    const { req, res } = this.getRequestResponse(context);
    const tracker = await getTracker(req, context);
    if (!tracker) return true;

    const name = throttler.name ?? 'default';
    const key = generateKey(context, tracker, name);
    const hit = await this.storageService.increment(key, ttl, limit, blockDuration, name);
    if (hit.isBlocked) {
      const retryAfter = Math.max(1, hit.timeToBlockExpire);
      (res as ResLike).header('Retry-After', String(retryAfter));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many requests, try again in ${retryAfter} s`,
          error: 'Too Many Requests',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const refund = throttler.refund;
    const storage = this.storageService as Refundable;
    if (refund && storage.refund) {
      (res as ResLike).once('finish', () => {
        if (refund((res as ResLike).statusCode)) void storage.refund!(key);
      });
    }
    return true;
  }
}

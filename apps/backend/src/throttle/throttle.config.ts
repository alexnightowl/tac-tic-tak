/**
 * Rate limits (B11). One entry per named throttler.
 *
 * - `global` applies to every route, keyed per user (verified JWT `sub`)
 *   or per client IP when the request is anonymous.
 * - Every other entry applies only to routes that opt in with
 *   `@RateLimit(name)` (see rate-limit.decorator.ts).
 *
 * `refund` makes a throttler count only the outcomes that matter: login
 * counts failed attempts (a successful login gives its hit back, so a
 * household logging in and out is never blocked) and register counts
 * created accounts (a validation error gives its hit back). The guard
 * still counts every request while it is in flight, so a parallel burst
 * cannot overshoot the limit before the refunds land.
 *
 * Every value can be overridden per environment, mainly for tests:
 *   THROTTLE_ENABLED=false                 turns the guard off entirely
 *   THROTTLE_<NAME>_LIMIT=<n>              e.g. THROTTLE_LOGIN_IP_LIMIT=2
 *   THROTTLE_<NAME>_TTL_SEC=<seconds>      window length (also the block length)
 * where <NAME> is the throttler name upper-cased with '-' → '_'.
 */
export type ThrottleKeyBy = 'user-or-ip' | 'ip' | 'nickname';

export type ThrottleRule = {
  limit: number;
  ttlSec: number;
  keyBy: ThrottleKeyBy;
  /** Give the hit back once the response finished with this status. */
  refund?: (status: number) => boolean;
};

const success = (status: number) => status < 400;
const failure = (status: number) => status >= 400;

export const THROTTLE_DEFAULTS = {
  global: { limit: 120, ttlSec: 60, keyBy: 'user-or-ip' },
  'login-ip': { limit: 5, ttlSec: 60, keyBy: 'ip', refund: success },
  'login-nickname': { limit: 10, ttlSec: 3600, keyBy: 'nickname', refund: success },
  register: { limit: 3, ttlSec: 3600, keyBy: 'ip', refund: failure },
  // Applied by B4's POST /auth/refresh (`@RateLimit('refresh')`); unused until then.
  refresh: { limit: 30, ttlSec: 60, keyBy: 'ip' },
  search: { limit: 30, ttlSec: 60, keyBy: 'user-or-ip' },
  avatar: { limit: 10, ttlSec: 3600, keyBy: 'user-or-ip' },
  'friend-request': { limit: 30, ttlSec: 3600, keyBy: 'user-or-ip' },
} satisfies Record<string, ThrottleRule>;

export type ThrottleName = keyof typeof THROTTLE_DEFAULTS;
export const GLOBAL_THROTTLE: ThrottleName = 'global';

function envInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function throttleEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.THROTTLE_ENABLED ?? '').trim().toLowerCase();
  return !(raw === 'false' || raw === '0' || raw === 'off' || raw === 'no');
}

/** Defaults with the THROTTLE_* environment overrides applied. */
export function resolveThrottleRules(env: NodeJS.ProcessEnv = process.env): Record<ThrottleName, ThrottleRule> {
  const out = {} as Record<ThrottleName, ThrottleRule>;
  for (const [name, rule] of Object.entries(THROTTLE_DEFAULTS) as [ThrottleName, ThrottleRule][]) {
    const prefix = `THROTTLE_${name.toUpperCase().replace(/-/g, '_')}`;
    out[name] = {
      ...rule,
      limit: envInt(env, `${prefix}_LIMIT`, rule.limit),
      ttlSec: envInt(env, `${prefix}_TTL_SEC`, rule.ttlSec),
    };
  }
  return out;
}

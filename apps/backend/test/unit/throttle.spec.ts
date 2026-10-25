import { clientIp, normalizeIp } from '../../src/throttle/client-ip';
import { RedisThrottlerStorage } from '../../src/throttle/redis-throttler.storage';
import { resolveThrottleRules, THROTTLE_DEFAULTS, throttleEnabled } from '../../src/throttle/throttle.config';

describe('throttle config', () => {
  it('defaults match PLAN §4 B11', () => {
    const r = resolveThrottleRules({});
    const brief = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, `${v.limit}/${v.ttlSec}s by ${v.keyBy}`]));
    expect(brief).toEqual({
      global: '120/60s by user-or-ip',
      'login-ip': '5/60s by ip',
      'login-nickname': '10/3600s by nickname',
      register: '3/3600s by ip',
      refresh: '30/60s by ip',
      search: '30/60s by user-or-ip',
      avatar: '10/3600s by user-or-ip',
      'friend-request': '30/3600s by user-or-ip',
    });
  });

  it('env overrides limit and window per throttler; junk values fall back to the default', () => {
    const r = resolveThrottleRules({
      THROTTLE_LOGIN_IP_LIMIT: '2',
      THROTTLE_LOGIN_IP_TTL_SEC: '5',
      THROTTLE_FRIEND_REQUEST_LIMIT: '7',
      THROTTLE_GLOBAL_LIMIT: 'lots',
      THROTTLE_SEARCH_LIMIT: '0',
    });
    expect(r['login-ip']).toMatchObject({ limit: 2, ttlSec: 5 });
    expect(r['friend-request'].limit).toBe(7);
    expect(r.global.limit).toBe(THROTTLE_DEFAULTS.global.limit);
    expect(r.search.limit).toBe(THROTTLE_DEFAULTS.search.limit);
  });

  it('refund policy: login gives successes back, register gives failures back', () => {
    const r = resolveThrottleRules({});
    expect(r['login-ip'].refund?.(201)).toBe(true);
    expect(r['login-ip'].refund?.(401)).toBe(false);
    expect(r['login-nickname'].refund?.(201)).toBe(true);
    expect(r.register.refund?.(400)).toBe(true);
    expect(r.register.refund?.(201)).toBe(false);
    expect(r.global.refund).toBeUndefined();
  });

  it('THROTTLE_ENABLED', () => {
    expect(throttleEnabled({})).toBe(true);
    expect(throttleEnabled({ THROTTLE_ENABLED: 'true' })).toBe(true);
    for (const off of ['false', '0', 'off', 'NO']) expect(throttleEnabled({ THROTTLE_ENABLED: off })).toBe(false);
  });
});

describe('client IP', () => {
  const app = (trust: unknown) => ({ get: (k: string) => (k === 'trust proxy' ? trust : undefined) });

  it('unwraps IPv4-mapped IPv6 and keys IPv6 by /64', () => {
    expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeIp('203.0.113.9')).toBe('203.0.113.9');
    expect(normalizeIp('2001:db8:abcd:12:1:2:3:4')).toBe('2001:db8:abcd:12::/64');
    expect(normalizeIp('2001:db8:abcd:12::99')).toBe('2001:db8:abcd:12::/64');
    expect(normalizeIp('2001:DB8::1')).toBe('2001:db8:0:0::/64');
    expect(normalizeIp('::1')).toBe('0:0:0:0::/64');
    expect(normalizeIp('fe80::1%en0')).toBe('fe80:0:0:0::/64');
  });

  it('uses req.ip when trust proxy is set (express resolved X-Forwarded-For)', () => {
    expect(clientIp({ ip: '198.51.100.7', headers: { 'x-forwarded-for': '198.51.100.7' }, app: app(1) })).toBe('198.51.100.7');
  });

  it('direct connections use the socket address', () => {
    expect(clientIp({ ip: '::ffff:10.0.0.5', headers: {}, app: app(false) })).toBe('10.0.0.5');
    expect(clientIp({ headers: {}, socket: { remoteAddress: '10.0.0.6' }, app: app(false) })).toBe('10.0.0.6');
  });

  it('is unknown (null) for a proxied request when trust proxy is off', () => {
    expect(clientIp({ ip: '172.18.0.5', headers: { 'x-forwarded-for': '203.0.113.1' }, app: app(false) })).toBeNull();
  });
});

describe('RedisThrottlerStorage when Redis is unreachable', () => {
  const saved = process.env.REDIS_URL;
  let storage: RedisThrottlerStorage;

  beforeAll(async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:1/9'; // nothing listens on port 1
    storage = new RedisThrottlerStorage();
    (storage as unknown as { log: { warn: () => void } }).log = { warn: () => undefined };
    await storage.onModuleInit();
  });
  afterAll(async () => {
    await storage.onModuleDestroy();
    if (saved === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = saved;
  });

  it('fails open quickly instead of blocking or hanging the request', async () => {
    const started = Date.now();
    const rec = await storage.increment('throttle:test:x', 60_000, 1, 60_000);
    expect(rec).toEqual({ totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 });
    expect(Date.now() - started).toBeLessThan(1000);
    await expect(storage.refund('throttle:test:x')).resolves.toBeUndefined();
  });
});

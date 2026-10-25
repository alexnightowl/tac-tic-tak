import {
  accessTokenTtlSec,
  DEFAULT_ACCESS_TOKEN_TTL_SEC,
  DEFAULT_REFRESH_TOKEN_TTL_DAYS,
  parseDurationSec,
  refreshTokenTtlDays,
} from '../../src/auth/auth.config';
import { TokenVersionService, tokenVersionKey } from '../../src/auth/token-version.service';

describe('auth env config (B4)', () => {
  it('parses durations in seconds (a bare number is seconds, not jsonwebtoken ms)', () => {
    expect(parseDurationSec('1800')).toBe(1800);
    expect(parseDurationSec('45s')).toBe(45);
    expect(parseDurationSec('30m')).toBe(1800);
    expect(parseDurationSec(' 1H ')).toBe(3600);
    expect(parseDurationSec('2d')).toBe(172800);
    for (const bad of ['', '0', '-5m', '1.5h', '30 minutes', 'abc', '7w']) expect(parseDurationSec(bad)).toBeNull();
  });

  it('ACCESS_TOKEN_TTL defaults to 30 min and falls back on a bad value instead of failing boot', () => {
    expect(DEFAULT_ACCESS_TOKEN_TTL_SEC).toBe(1800);
    expect(accessTokenTtlSec({})).toBe(1800);
    expect(accessTokenTtlSec({ ACCESS_TOKEN_TTL: '' })).toBe(1800);
    expect(accessTokenTtlSec({ ACCESS_TOKEN_TTL: '15m' })).toBe(900);
    expect(accessTokenTtlSec({ ACCESS_TOKEN_TTL: 'soon' })).toBe(1800);
  });

  it('REFRESH_TOKEN_TTL_DAYS defaults to 90 and accepts integers 1..365', () => {
    expect(DEFAULT_REFRESH_TOKEN_TTL_DAYS).toBe(90);
    expect(refreshTokenTtlDays({})).toBe(90);
    expect(refreshTokenTtlDays({ REFRESH_TOKEN_TTL_DAYS: '30' })).toBe(30);
    for (const bad of ['0', '366', '1.5', 'x']) expect(refreshTokenTtlDays({ REFRESH_TOKEN_TTL_DAYS: bad })).toBe(90);
  });
});

describe('TokenVersionService fallbacks', () => {
  const prismaWith = (row: { tokenVersion: number } | null) => {
    const findUnique = jest.fn().mockResolvedValue(row);
    return { prisma: { user: { findUnique } } as never, findUnique };
  };

  it('reads the Redis cache first', async () => {
    const { prisma, findUnique } = prismaWith({ tokenVersion: 9 });
    const redis = { client: { get: jest.fn().mockResolvedValue('3'), set: jest.fn().mockResolvedValue('OK') } };
    const svc = new TokenVersionService(prisma, redis as never);
    expect(await svc.current('u1')).toBe(3);
    expect(redis.client.get).toHaveBeenCalledWith(tokenVersionKey('u1'));
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('a hung Redis (offline queue) falls back to Postgres within the timeout instead of hanging the request', async () => {
    const { prisma, findUnique } = prismaWith({ tokenVersion: 2 });
    const never = () => new Promise<never>(() => undefined);
    const redis = { client: { get: jest.fn(never), set: jest.fn(never) } };
    const svc = new TokenVersionService(prisma, redis as never);
    (svc as unknown as { log: { warn: () => void } }).log.warn = () => undefined;
    const started = Date.now();
    expect(await svc.current('u1')).toBe(2);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('a missing user is null (not rejected, not cached)', async () => {
    const { prisma } = prismaWith(null);
    const redis = { client: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK') } };
    const svc = new TokenVersionService(prisma, redis as never);
    expect(await svc.current('gone')).toBeNull();
    expect(redis.client.set).not.toHaveBeenCalled();
  });
});

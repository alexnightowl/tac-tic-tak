import { loadAppConfig, parseBuildHeader, parseFeatureFlags, parsePlatform } from '../../src/app-config/app-config';
import { minBuildGate } from '../../src/app-config/min-build.middleware';

describe('loadAppConfig (B3)', () => {
  it('defaults: no gate, nulls, no flags, no maintenance', () => {
    expect(loadAppConfig({})).toEqual({
      minSupportedBuild: { ios: 0, android: 0 },
      latestBuild: { ios: null, android: null },
      storeUrls: { ios: null, android: null },
      featureFlags: {},
      maintenance: null,
    });
  });

  it('reads every key', () => {
    expect(
      loadAppConfig({
        MIN_SUPPORTED_BUILD_IOS: ' 12 ',
        MIN_SUPPORTED_BUILD_ANDROID: '7',
        LATEST_BUILD_IOS: '20',
        LATEST_BUILD_ANDROID: '9',
        APP_STORE_URL: 'https://apps.apple.com/x',
        PLAY_STORE_URL: 'https://play.google.com/y',
        FEATURE_FLAGS: '{"a":true,"b":false}',
        MAINTENANCE_MESSAGE: 'Back at 10:00 UTC',
      }),
    ).toEqual({
      minSupportedBuild: { ios: 12, android: 7 },
      latestBuild: { ios: 20, android: 9 },
      storeUrls: { ios: 'https://apps.apple.com/x', android: 'https://play.google.com/y' },
      featureFlags: { a: true, b: false },
      maintenance: { message: 'Back at 10:00 UTC' },
    });
  });

  it('malformed values fall back and warn instead of crashing the boot', () => {
    const warn = jest.fn();
    const cfg = loadAppConfig({ MIN_SUPPORTED_BUILD_IOS: 'abc', LATEST_BUILD_ANDROID: '-3', FEATURE_FLAGS: '{oops' }, warn);
    expect(cfg.minSupportedBuild.ios).toBe(0);
    expect(cfg.latestBuild.android).toBeNull();
    expect(cfg.featureFlags).toEqual({});
    expect(warn).toHaveBeenCalledTimes(3);
  });
});

describe('parseFeatureFlags', () => {
  it('comma list: names on, -name / !name off, blanks skipped', () => {
    expect(parseFeatureFlags('a, b ,-c,!d,,')).toEqual({ a: true, b: true, c: false, d: false });
  });
  it('JSON: keeps booleans only', () => {
    const warn = jest.fn();
    expect(parseFeatureFlags('{"a":true,"n":1}', warn)).toEqual({ a: true });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(parseFeatureFlags('[1]', warn)).toEqual({});
  });
});

describe('header parsing', () => {
  it('parsePlatform', () => {
    expect(parsePlatform('ios')).toBe('ios');
    expect(parsePlatform(' Android ')).toBe('android');
    expect(parsePlatform('web')).toBeNull();
    expect(parsePlatform(undefined)).toBeNull();
  });
  it('parseBuildHeader', () => {
    expect(parseBuildHeader('42')).toBe(42);
    expect(parseBuildHeader(' 7 ')).toBe(7);
    expect(parseBuildHeader('1.2.3')).toBeNull();
    expect(parseBuildHeader('-1')).toBeNull();
    expect(parseBuildHeader('')).toBeNull();
    expect(parseBuildHeader('99999999999999999999')).toBeNull();
  });
});

describe('minBuildGate', () => {
  const cfg = loadAppConfig({ MIN_SUPPORTED_BUILD_IOS: '10', PLAY_STORE_URL: 'p' });
  const gate = minBuildGate(cfg);
  function run(url: string, headers: Record<string, string | string[]>, method = 'GET') {
    const res: any = { status: jest.fn(() => res), json: jest.fn(() => res) };
    const next = jest.fn();
    gate({ method, originalUrl: url, url, headers } as any, res, next);
    return { res, next };
  }

  it('passes without X-App-Build', () => {
    expect(run('/api/users/me', { 'x-platform': 'ios' }).next).toHaveBeenCalled();
  });
  it('426 below the minimum, pass at/above it', () => {
    const low = run('/api/v1/users/me', { 'x-app-build': '9', 'x-platform': 'ios' });
    expect(low.next).not.toHaveBeenCalled();
    expect(low.res.status).toHaveBeenCalledWith(426);
    expect(run('/api/v1/users/me', { 'x-app-build': '10', 'x-platform': 'ios' }).next).toHaveBeenCalled();
  });
  it('a platform without a configured minimum is never gated', () => {
    expect(run('/api/users/me', { 'x-app-build': '0', 'x-platform': 'android' }).next).toHaveBeenCalled();
  });
  it('exempts app-config, health (any version, with query), non-/api paths and OPTIONS', () => {
    const h = { 'x-app-build': '1', 'x-platform': 'ios' };
    for (const url of ['/api/app-config', '/api/v1/app-config?x=1', '/api/health', '/api/v1/health', '/uploads/a.png']) {
      expect(run(url, h).next).toHaveBeenCalled();
    }
    expect(run('/api/users/me', h, 'OPTIONS').next).toHaveBeenCalled();
  });
  it('matches paths case-insensitively, like Express routing', () => {
    const h = { 'x-app-build': '1', 'x-platform': 'ios' };
    expect(run('/api/v1/App-Config', h).next).toHaveBeenCalled();
    expect(run('/API/Health', h).next).toHaveBeenCalled();
    expect(run('/API/users/me', h).next).not.toHaveBeenCalled();
  });
  it('does not exempt look-alike paths', () => {
    const h = { 'x-app-build': '1', 'x-platform': 'ios' };
    expect(run('/api/healthz', h).next).not.toHaveBeenCalled();
    expect(run('/api/app-configs', h).next).not.toHaveBeenCalled();
  });
});

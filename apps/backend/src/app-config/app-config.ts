/**
 * Mobile app configuration (B3), read from env once at boot.
 *
 *   MIN_SUPPORTED_BUILD_IOS / MIN_SUPPORTED_BUILD_ANDROID  integer build numbers; unset/0 = no gate
 *   LATEST_BUILD_IOS / LATEST_BUILD_ANDROID                integer build numbers; unset = null
 *   APP_STORE_URL / PLAY_STORE_URL                         store links; unset = null
 *   FEATURE_FLAGS      either a JSON object of booleans ('{"a":true,"b":false}')
 *                      or a comma list ('a,b,-c' → {a:true, b:true, c:false}); unset = {}
 *   MAINTENANCE_MESSAGE  non-empty → maintenance: {message}; unset = null
 *
 * Malformed values never stop the boot (the live web must keep running):
 * they fall back to the "unset" value and are reported through `warn`.
 */
export type MobilePlatform = 'ios' | 'android';

export type AppConfig = {
  minSupportedBuild: Record<MobilePlatform, number>;
  latestBuild: Record<MobilePlatform, number | null>;
  storeUrls: Record<MobilePlatform, string | null>;
  featureFlags: Record<string, boolean>;
  maintenance: { message: string } | null;
};

export const APP_CONFIG_ENV_KEYS = [
  'MIN_SUPPORTED_BUILD_IOS',
  'MIN_SUPPORTED_BUILD_ANDROID',
  'LATEST_BUILD_IOS',
  'LATEST_BUILD_ANDROID',
  'APP_STORE_URL',
  'PLAY_STORE_URL',
  'FEATURE_FLAGS',
  'MAINTENANCE_MESSAGE',
] as const;

type Warn = (message: string) => void;

const BUILD_RE = /^\d+$/;

function blank(v: string | undefined): v is undefined {
  return v === undefined || v.trim() === '';
}

function parseBuild(env: NodeJS.ProcessEnv, key: string, warn: Warn): number | null {
  const raw = env[key];
  if (blank(raw)) return null;
  const v = raw.trim();
  if (!BUILD_RE.test(v) || !Number.isSafeInteger(Number(v))) {
    warn(`${key}="${raw}" is not a non-negative integer build number; ignored`);
    return null;
  }
  return Number(v);
}

function parseString(env: NodeJS.ProcessEnv, key: string): string | null {
  const raw = env[key];
  return blank(raw) ? null : raw.trim();
}

export function parseFeatureFlags(raw: string | undefined, warn: Warn = () => {}): Record<string, boolean> {
  if (blank(raw)) return {};
  const v = raw.trim();
  const flags: Record<string, boolean> = {};
  if (v.startsWith('{') || v.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(v);
    } catch {
      warn('FEATURE_FLAGS is not valid JSON; ignored');
      return {};
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      warn('FEATURE_FLAGS JSON must be an object; ignored');
      return {};
    }
    for (const [k, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof val === 'boolean') flags[k] = val;
      else warn(`FEATURE_FLAGS.${k} is not a boolean; ignored`);
    }
    return flags;
  }
  for (const part of v.split(',')) {
    const item = part.trim();
    if (!item) continue;
    const off = item.startsWith('-') || item.startsWith('!');
    const name = off ? item.slice(1).trim() : item;
    if (name) flags[name] = !off;
  }
  return flags;
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env, warn: Warn = () => {}): AppConfig {
  const message = parseString(env, 'MAINTENANCE_MESSAGE');
  return {
    minSupportedBuild: {
      ios: parseBuild(env, 'MIN_SUPPORTED_BUILD_IOS', warn) ?? 0,
      android: parseBuild(env, 'MIN_SUPPORTED_BUILD_ANDROID', warn) ?? 0,
    },
    latestBuild: {
      ios: parseBuild(env, 'LATEST_BUILD_IOS', warn),
      android: parseBuild(env, 'LATEST_BUILD_ANDROID', warn),
    },
    storeUrls: {
      ios: parseString(env, 'APP_STORE_URL'),
      android: parseString(env, 'PLAY_STORE_URL'),
    },
    featureFlags: parseFeatureFlags(env.FEATURE_FLAGS, warn),
    maintenance: message ? { message } : null,
  };
}

/** 'ios' | 'android' from an X-Platform header value (case-insensitive), else null. */
export function parsePlatform(value: string | undefined): MobilePlatform | null {
  const v = value?.trim().toLowerCase();
  return v === 'ios' || v === 'android' ? v : null;
}

/** Integer build number from an X-App-Build header value, else null (malformed = no gate). */
export function parseBuildHeader(value: string | undefined): number | null {
  const v = value?.trim();
  if (!v || !BUILD_RE.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : null;
}

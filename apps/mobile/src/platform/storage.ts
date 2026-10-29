import { createMMKV, type MMKV } from 'react-native-mmkv';

// Named MMKV instances (PLAN §2.4). Separate files so `resetAll()` can wipe
// one concern (the query cache, a runner snapshot) without touching prefs.
// MMKV reads are synchronous JSI calls, so the first frame already sees them.

/** Settings, language, device prefs (feel, last setup…). Web key names kept. */
export const appKV: MMKV = createMMKV({ id: 'app' });
/** Persisted react-query cache (read screens only). */
export const queryKV: MMKV = createMMKV({ id: 'query' });
/** Active runner snapshot + attempt outbox. */
export const sessionKV: MMKV = createMMKV({ id: 'session' });

/**
 * Offline puzzles (docs/mobile/OFFLINE.md): packs, the Review pack and the
 * pending-results queue, namespaced by user id. Deliberately NOT wiped by
 * resetAll(): queued results must survive a logout (or a 401) until that
 * account signs in again and syncs them.
 */
export const offlineKV: MMKV = createMMKV({ id: 'offline' });

/** The three instances by PLAN name (`sessionKV` avoids shadowing the web global). */
export const storage = { app: appKV, query: queryKV, session: sessionKV } as const;

/** JSON read with a fallback: corrupt or missing → fallback (web loadPrefs rule). */
export function readJSON<T>(store: MMKV, key: string, fallback: T): T {
  try {
    const raw = store.getString(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(store: MMKV, key: string, value: unknown): void {
  try {
    store.set(key, JSON.stringify(value));
  } catch {
    // A failed write must never break the caller (web wrapped these too).
  }
}

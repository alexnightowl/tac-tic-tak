import { isApiError } from '@tac/core/api';
import {
  mergePuzzles,
  PACK_DEFAULT_COUNT,
  PACK_MAX_COUNT,
  playedIds,
  summarizeSync,
  syncBatches,
  toOfflinePuzzle,
  TOP_UP_TARGET,
  tzOffsetMinutes,
  unplayed,
  type OfflinePackKind,
  type OfflinePuzzle,
  type OfflineSyncBody,
  type OfflineSyncResponse,
} from '@tac/core/offline';
import type { TrainingStyle } from '@tac/core/rules';
import * as Network from 'expo-network';

import { HIDDEN_ACHIEVEMENTS } from '@/features/achievements/api';
import { readLastStyle } from '@/features/play/setupPrefs';
import { reviewApi } from '@/features/review/api';
import { queryClient } from '@/platform/query';
import { useShellStore } from '@/shell/store';
import { toast } from '@/shell/toast/store';
import { appStore } from '@/stores/appStore';
import { authStore } from '@/stores/authStore';
import { translatorFor } from '@/ui/lang';
import { isAborted, isUnavailable, offlineApi } from './api';
import { offlineStore } from './store';

// The offline sync engine (docs/mobile/OFFLINE.md "Sync"). One run at a
// time; every trigger (app start, foreground, network back, runner exit,
// before an online session) joins the run in flight. A queued result is
// removed only after its batch got a 2xx (duplicates and unknown puzzles
// included: the server receipted them), so a crash, a timeout or a 5xx
// just means the next run sends it again; the server dedupes on clientId.

export type SyncReason = 'start' | 'foreground' | 'network' | 'runner' | 'session' | 'manual';

type Net = { online: boolean; wifi: boolean };

/** forceOffline (dev / e2e "airplane mode") counts as no network. */
export async function readNetwork(): Promise<Net> {
  if (useShellStore.getState().forceOffline) return { online: false, wifi: false };
  try {
    const s = await Network.getNetworkStateAsync();
    return {
      online: s.isConnected !== false && s.isInternetReachable !== false,
      wifi: s.type === Network.NetworkStateType.WIFI || s.type === Network.NetworkStateType.ETHERNET,
    };
  } catch {
    // Unknown: try (a failed request is harmless), but never on cellular-only work.
    return { online: true, wifi: false };
  }
}

let inFlight: Promise<void> | null = null;
let lastReviewRefresh = 0;
/** The Review pack follows the server at most this often without a reason. */
const REVIEW_REFRESH_MS = 60_000;

export function requestSync(reason: SyncReason): Promise<void> {
  if (!inFlight) {
    inFlight = run(reason)
      .catch(() => undefined)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * Before an online session starts: an online session that already ticked
 * today can't backfill an earlier offline day, so the queue goes first.
 * Bounded, and never throws: a failed sync must not block playing.
 */
export async function syncBeforeOnlineSession(maxMs = 8000): Promise<void> {
  if (offlineStore.getState().queue.length === 0) return;
  await Promise.race([requestSync('session'), new Promise<void>((r) => setTimeout(r, maxMs))]);
}

async function run(reason: SyncReason): Promise<void> {
  if (authStore.getState().status !== 'authed') return;
  const uid = offlineStore.getState().uid;
  if (!uid) return;
  const net = await readNetwork();
  if (!net.online) return;

  const flushed = await flushQueue(uid);
  if (offlineStore.getState().uid !== uid) return;

  const due = flushed > 0 || reason === 'manual' || Date.now() - lastReviewRefresh > REVIEW_REFRESH_MS;
  if (due) await refreshReview(uid);

  if (net.wifi && offlineStore.getState().topUp && offlineStore.getState().uid === uid) {
    await topUp();
  }
}

/** Posts the queue, one batch per style. Returns how many results left the queue. */
async function flushQueue(uid: string): Promise<number> {
  const store = offlineStore.getState();
  const queue = store.queue;
  if (queue.length === 0) {
    if (store.sync !== 'idle') store.setSync('idle');
    return 0;
  }
  store.setSync('syncing');
  const results: { body: OfflineSyncBody; res: OfflineSyncResponse }[] = [];
  let removed = 0;
  let status: 'idle' | 'failed' | 'unavailable' = 'idle';
  for (const body of syncBatches(queue, tzOffsetMinutes(new Date()))) {
    let res: OfflineSyncResponse;
    try {
      res = await offlineApi.sync(body);
    } catch (e) {
      status = isUnavailable(e) ? 'unavailable' : 'failed';
      break;
    }
    // A logout mid-flight: the results stay in that account's queue on disk
    // and are re-sent (deduped) on its next sync.
    const s = offlineStore.getState();
    if (s.uid !== uid) return removed;
    results.push({ body, res });
    const ids = new Set(body.attempts.map((a) => a.clientId));
    const sent = queue.filter((r) => ids.has(r.clientId));
    // Puzzles leave their pack before their results leave the queue: a
    // crash in between re-sends a deduped result, never re-serves a puzzle.
    const byPack = new Map<OfflinePackKind, Set<string>>();
    for (const r of sent) {
      if (r.pack === 'review') continue;
      const set = byPack.get(r.pack) ?? new Set<string>();
      set.add(r.puzzleId);
      byPack.set(r.pack, set);
    }
    for (const [kind, set] of byPack) s.prune(kind, set);
    s.dequeue(ids);
    removed += ids.size;
  }
  offlineStore.getState().setSync(status);
  if (results.length > 0) {
    const summary = summarizeSync(results);
    // Ratings, streak, review queue, history and stats all moved.
    void queryClient.invalidateQueries();
    const t = translatorFor(appStore.getState().settings.language).t;
    const unlocked = summary.achievements.filter((a) => !HIDDEN_ACHIEVEMENTS.has(a));
    if (unlocked.length > 0) toast.achievements(unlocked, t);
    if (summary.synced > 0) offlineStore.getState().showSummary(summary);
  }
  return removed;
}

/**
 * The Review pack mirrors GET /review (unresolved items). The list has no
 * full line, so each new puzzle is fetched once from GET /review/:id;
 * puzzles already on the phone are kept as they are.
 */
async function refreshReview(uid: string): Promise<void> {
  const store = offlineStore.getState();
  if (!store.review) store.setReviewLoading(true);
  try {
    const list = await reviewApi.list();
    const have = new Map((offlineStore.getState().review?.puzzles ?? []).map((p) => [p.id, p]));
    const missing = list.map((i) => i.puzzleId).filter((id) => !have.has(id));
    const fetched = new Map<string, OfflinePuzzle>();
    // Four at a time: a long review queue fills without a request storm.
    for (let i = 0; i < missing.length; i += 4) {
      const chunk = missing.slice(i, i + 4);
      const got = await Promise.allSettled(chunk.map((id) => reviewApi.puzzle(id)));
      got.forEach((g) => {
        if (g.status === 'fulfilled') fetched.set(g.value.id, toOfflinePuzzle(g.value));
      });
    }
    if (offlineStore.getState().uid !== uid) return;
    const puzzles = list
      .map((i) => have.get(i.puzzleId) ?? fetched.get(i.puzzleId))
      .filter((p): p is OfflinePuzzle => !!p);
    offlineStore.getState().setReview({
      kind: 'review',
      style: null,
      baseRating: null,
      downloadedAt: new Date().toISOString(),
      puzzles,
    });
    lastReviewRefresh = Date.now();
  } catch {
    // Keep what the phone has; the next trigger retries.
  } finally {
    if (offlineStore.getState().uid === uid) offlineStore.getState().setReviewLoading(false);
  }
}

// ─── Downloads ───────────────────────────────────────────────────────────

const controllers = new Map<OfflinePackKind, AbortController>();

export type DownloadResult = 'ok' | 'offline' | 'unavailable' | 'error' | 'cancelled' | 'busy';

/**
 * Downloads (or refills) a pack so it holds `count` unplayed puzzles. The
 * unplayed puzzles already on the phone are kept; played ones stay until
 * their results sync. Network has no progress events here: the row shows
 * an eased bar until the response lands.
 */
export async function downloadPack(kind: OfflinePackKind, opts: { count?: number; style?: TrainingStyle } = {}): Promise<DownloadResult> {
  const store = offlineStore.getState();
  const uid = store.uid;
  if (!uid) return 'error';
  if (store.downloads[kind]?.status === 'loading') return 'busy';
  const net = await readNetwork();
  if (!net.online) {
    offlineStore.getState().setDownload(kind, { status: 'offline' });
    return 'offline';
  }
  const existing = offlineStore.getState().packs[kind];
  const style = opts.style ?? existing?.style ?? readLastStyle();
  const sameStyle = existing?.style === style;
  const played = playedIds(offlineStore.getState().queue, kind);
  const pending = sameStyle && existing ? existing.puzzles.filter((p) => played.has(p.id)) : [];
  const kept = sameStyle && existing ? unplayed(existing.puzzles, played) : [];
  const target = Math.min(PACK_MAX_COUNT, opts.count ?? PACK_DEFAULT_COUNT[kind]);
  if (kept.length >= target) return 'ok';

  const ctrl = new AbortController();
  controllers.set(kind, ctrl);
  offlineStore.getState().setDownload(kind, { status: 'loading', startedAt: Date.now() });
  try {
    // Ask for the whole target: the server can't know which unplayed
    // puzzles the phone already holds, so some come back again (deduped).
    const count = target;
    const res = await offlineApi.pack({ kind, style, count }, ctrl.signal);
    const s = offlineStore.getState();
    if (s.uid !== uid) return 'cancelled';
    const merged = mergePuzzles(kept, res.puzzles.map(toOfflinePuzzle), target);
    s.savePack(kind, {
      kind,
      style: res.style ?? style,
      baseRating: res.baseRating ?? null,
      downloadedAt: new Date().toISOString(),
      puzzles: [...pending, ...merged],
    });
    s.setDownload(kind, null);
    return 'ok';
  } catch (e) {
    const s = offlineStore.getState();
    if (isAborted(e)) {
      s.setDownload(kind, null);
      return 'cancelled';
    }
    const unavailable = isUnavailable(e);
    s.setDownload(kind, { status: unavailable ? 'unavailable' : 'error' });
    return unavailable ? 'unavailable' : isApiError(e) && e.kind !== 'http' ? 'offline' : 'error';
  } finally {
    if (controllers.get(kind) === ctrl) controllers.delete(kind);
  }
}

export function cancelDownload(kind: OfflinePackKind): void {
  controllers.get(kind)?.abort();
}

/** Level pack back to TOP_UP_TARGET unplayed puzzles (auto on Wi-Fi, or "Refill to 50"). */
export async function topUp(): Promise<DownloadResult> {
  const s = offlineStore.getState();
  const level = s.packs.level;
  const left = level ? unplayed(level.puzzles, playedIds(s.queue, 'level')).length : 0;
  if (left >= TOP_UP_TARGET) return 'ok';
  // A download that failed for good this launch (404) is not retried silently.
  if (s.downloads.level?.status === 'unavailable') return 'unavailable';
  return downloadPack('level', { count: TOP_UP_TARGET });
}

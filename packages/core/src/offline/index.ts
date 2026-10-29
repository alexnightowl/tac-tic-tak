// Offline puzzles (docs/mobile/OFFLINE.md): the wire types of
// GET /offline/pack and POST /offline/sync, and the pure queue / pack
// bookkeeping the mobile store and sync engine run on.
import type { TrainingStyle } from '../rules';
import { normalizeMoves } from '../runner';

export type OfflinePackKind = 'level' | 'weak' | 'mate' | 'endgame' | 'hard';

/** Display order of the downloadable packs. */
export const OFFLINE_PACK_KINDS: readonly OfflinePackKind[] = ['level', 'weak', 'mate', 'endgame', 'hard'];

/** Server default count per kind (OFFLINE.md); max 150. */
export const PACK_DEFAULT_COUNT: Record<OfflinePackKind, number> = { level: 50, weak: 30, mate: 40, endgame: 40, hard: 30 };
export const PACK_MAX_COUNT = 150;
/** "Flight pack": the level pack filled to the max. */
export const FLIGHT_PACK_COUNT = PACK_MAX_COUNT;
/** "Keep topped up" / "Refill to 50" target for the level pack. */
export const TOP_UP_TARGET = 50;
/** Attempts per POST (one TrainingSession each); a long trip splits into a few. */
export const SYNC_BATCH_MAX = 200;

export type OfflinePuzzle = { id: string; fen: string; moves: string[]; rating: number; themes: string[] };

/** GET /offline/pack?kind&style&count */
export type OfflinePackResponse = {
  kind: OfflinePackKind;
  style: TrainingStyle;
  generatedAt: string;
  baseRating: number;
  puzzles: Array<Omit<OfflinePuzzle, 'moves' | 'themes'> & { moves: string | string[]; themes?: string[] | null }>;
};

export type OfflineSource = 'pack' | 'review';

/** One attempt as POST /offline/sync takes it. */
export type OfflineAttempt = {
  clientId: string;
  puzzleId: string;
  correct: boolean;
  responseMs: number;
  /** ISO time solved. */
  solvedAt: string;
  /** The player's 'YYYY-MM-DD' that day. */
  localDay: string;
  source: OfflineSource;
};

/** A queued result on the phone: the attempt plus where it came from. */
export type PendingResult = OfflineAttempt & {
  /** The batch it goes in (pack: the pack's style; review: the style picked then). */
  style: TrainingStyle;
  pack: OfflinePackKind | 'review';
};

export type OfflineSyncBody = { style: TrainingStyle; tzOffsetMin: number; attempts: OfflineAttempt[] };

export type OfflineStreakOutcome = 'same-day' | 'continued' | 'frozen' | 'reset' | 'started' | 'skipped';

/** POST /offline/sync response. */
export type OfflineSyncResponse = {
  sessionId: string | null;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  solved: number;
  total: number;
  accuracy: number;
  timeMs: number;
  mistakesToReview: number;
  reviewResolved: number;
  duplicates: number;
  streak: { days: number; outcome: OfflineStreakOutcome } | null;
};

/** A stored pack. Played puzzles stay until their results sync. */
export type StoredPack = {
  kind: OfflinePackKind | 'review';
  style: TrainingStyle | null;
  baseRating: number | null;
  downloadedAt: string;
  puzzles: OfflinePuzzle[];
};

export function toOfflinePuzzle(p: OfflinePackResponse['puzzles'][number]): OfflinePuzzle {
  return { id: p.id, fen: p.fen, moves: normalizeMoves(p.moves), rating: p.rating, themes: p.themes ?? [] };
}

/** The pack's puzzles not yet played (played = a result is queued for it). */
export function unplayed(puzzles: readonly OfflinePuzzle[], played: ReadonlySet<string>): OfflinePuzzle[] {
  return puzzles.filter((p) => !played.has(p.id));
}

/** Puzzle ids with a queued result, per source. */
export function playedIds(queue: readonly PendingResult[], pack: PendingResult['pack']): Set<string> {
  const out = new Set<string>();
  for (const r of queue) if (r.pack === pack) out.add(r.puzzleId);
  return out;
}

/**
 * Merges a fresh download into what the phone holds: keep the unplayed
 * puzzles already there, add new ids in server order, up to `cap`.
 */
export function mergePuzzles(kept: readonly OfflinePuzzle[], fresh: readonly OfflinePuzzle[], cap: number): OfflinePuzzle[] {
  const seen = new Set(kept.map((p) => p.id));
  const out = kept.slice(0, cap);
  for (const p of fresh) {
    if (out.length >= cap) break;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

/**
 * The queue as POST bodies: one per style (pack attempts take the batch's
 * style), each in solvedAt order, split at SYNC_BATCH_MAX.
 */
export function syncBatches(queue: readonly PendingResult[], tzOffsetMin: number, max = SYNC_BATCH_MAX): OfflineSyncBody[] {
  const byStyle = new Map<TrainingStyle, PendingResult[]>();
  for (const r of queue) {
    const list = byStyle.get(r.style) ?? [];
    list.push(r);
    byStyle.set(r.style, list);
  }
  const out: OfflineSyncBody[] = [];
  for (const [style, list] of byStyle) {
    const sorted = [...list].sort((a, b) => (a.solvedAt < b.solvedAt ? -1 : a.solvedAt > b.solvedAt ? 1 : 0));
    for (let i = 0; i < sorted.length; i += max) {
      out.push({
        style,
        tzOffsetMin,
        attempts: sorted.slice(i, i + max).map(({ clientId, puzzleId, correct, responseMs, solvedAt, localDay, source }) => ({
          clientId, puzzleId, correct, responseMs, solvedAt, localDay, source,
        })),
      });
    }
  }
  return out;
}

/** Minutes east of UTC, as the server's streak day math expects (-240 = UTC-4). */
export function tzOffsetMinutes(d: Date): number {
  const off = -d.getTimezoneOffset();
  return off === 0 ? 0 : off;
}

/** The "Welcome back" numbers over every batch of one sync. */
export type OfflineSyncSummary = {
  /** Rating catch-up per style that had pack attempts, in sync order. */
  ratings: Array<{ style: TrainingStyle; before: number; after: number; delta: number }>;
  /** Attempts the server took this time (duplicates excluded). */
  total: number;
  solved: number;
  accuracy: number;
  timeMs: number;
  mistakesToReview: number;
  reviewResolved: number;
  duplicates: number;
  /** The last batch's streak, if any batch touched it. */
  streak: OfflineSyncResponse['streak'];
};

export function summarizeSync(results: ReadonlyArray<{ body: OfflineSyncBody; res: OfflineSyncResponse }>): OfflineSyncSummary {
  const ratings: OfflineSyncSummary['ratings'] = [];
  let total = 0;
  let solved = 0;
  let timeMs = 0;
  let mistakesToReview = 0;
  let reviewResolved = 0;
  let duplicates = 0;
  let streak: OfflineSyncResponse['streak'] = null;
  for (const { body, res } of results) {
    total += res.total;
    solved += res.solved;
    timeMs += res.timeMs;
    mistakesToReview += res.mistakesToReview;
    reviewResolved += res.reviewResolved;
    duplicates += res.duplicates;
    if (res.streak) streak = res.streak;
    if (!body.attempts.some((a) => a.source === 'pack')) continue;
    const prev = ratings.find((r) => r.style === body.style);
    if (prev) {
      prev.after = res.ratingAfter;
      prev.delta = prev.after - prev.before;
    } else {
      ratings.push({ style: body.style, before: res.ratingBefore, after: res.ratingAfter, delta: res.ratingAfter - res.ratingBefore });
    }
  }
  return {
    ratings,
    total,
    solved,
    accuracy: total > 0 ? solved / total : 0,
    timeMs,
    mistakesToReview,
    reviewResolved,
    duplicates,
    streak,
  };
}

/** Most frequent themes of a pack (the weak-spots row names them). */
export function topThemes(puzzles: readonly OfflinePuzzle[], n: number, ignore: ReadonlySet<string> = new Set()): string[] {
  const count = new Map<string, number>();
  for (const p of puzzles) for (const t of p.themes) if (!ignore.has(t)) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n).map(([t]) => t);
}

/**
 * RFC 4122 v4 id from a byte source (crypto.getRandomValues where the
 * runtime has it). The server dedupes on it, so it must never repeat.
 */
export function uuidV4(randomBytes: (n: number) => Uint8Array): string {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

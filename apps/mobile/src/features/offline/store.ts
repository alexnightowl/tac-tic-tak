import {
  playedIds,
  unplayed,
  uuidV4,
  type OfflinePackKind,
  type OfflinePuzzle,
  type OfflineSyncSummary,
  type PendingResult,
  type StoredPack,
} from '@tac/core/offline';
import { create } from 'zustand';

import { offlineKV, readJSON, writeJSON } from '@/platform/storage';
import { authStore } from '@/stores/authStore';

// Offline puzzles on the phone (docs/mobile/OFFLINE.md). Everything lives
// in MMKV `offline` under the signed-in user's id, written synchronously on
// every change, so a crash or a kill never loses a queued result. Played
// puzzles are derived from the queue: a puzzle with a queued result is
// played until its result syncs (then a pack drops it, and the Review pack
// is rebuilt from the server).

export type PackKey = OfflinePackKind | 'review';

export type DownloadState =
  | { status: 'loading'; startedAt: number }
  | { status: 'error' }
  /** GET /offline/pack 404: the backend has not shipped it yet. */
  | { status: 'unavailable' }
  /** Tapped Get without a connection. */
  | { status: 'offline' };

export type SyncStatus = 'idle' | 'syncing' | 'failed' | 'unavailable';

type Persisted = {
  packs: Partial<Record<OfflinePackKind, StoredPack>>;
  review: StoredPack | null;
  queue: PendingResult[];
  topUp: boolean;
};

type OfflineState = Persisted & {
  uid: string | null;
  downloads: Partial<Record<OfflinePackKind, DownloadState>>;
  /** Review pack refresh in flight (first fill shows a spinner on the row). */
  reviewLoading: boolean;
  sync: SyncStatus;
  /** The last successful sync's numbers ("Welcome back"). */
  summary: OfflineSyncSummary | null;
  /** A summary waiting for a calm moment to be shown. */
  summaryPending: boolean;

  load: (uid: string | null) => void;
  savePack: (kind: OfflinePackKind, pack: StoredPack) => void;
  removePack: (kind: OfflinePackKind) => void;
  /** Drops puzzles from a pack (synced results, broken lines). */
  prune: (key: PackKey, ids: ReadonlySet<string>) => void;
  setReview: (pack: StoredPack | null) => void;
  enqueue: (r: Omit<PendingResult, 'clientId'>) => PendingResult;
  dequeue: (clientIds: ReadonlySet<string>) => void;
  setTopUp: (v: boolean) => void;
  setDownload: (kind: OfflinePackKind, d: DownloadState | null) => void;
  setReviewLoading: (v: boolean) => void;
  setSync: (s: SyncStatus) => void;
  showSummary: (s: OfflineSyncSummary) => void;
  ackSummary: () => void;
};

const KEY = {
  packs: (uid: string) => `${uid}.packs`,
  review: (uid: string) => `${uid}.review`,
  queue: (uid: string) => `${uid}.queue`,
  topUp: (uid: string) => `${uid}.topUp`,
};

const EMPTY: Persisted = { packs: {}, review: null, queue: [], topUp: true };

function readAll(uid: string | null): Persisted {
  if (!uid) return EMPTY;
  return {
    packs: readJSON(offlineKV, KEY.packs(uid), {}),
    review: readJSON<StoredPack | null>(offlineKV, KEY.review(uid), null),
    queue: readJSON<PendingResult[]>(offlineKV, KEY.queue(uid), []),
    // Default on (the design shows it on): 50 small puzzles, Wi-Fi only.
    topUp: offlineKV.getBoolean(KEY.topUp(uid)) ?? true,
  };
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(out);
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

const currentUid = () => authStore.getState().user?.id ?? null;

export const useOfflineStore = create<OfflineState>((set, get) => {
  const uid = currentUid();
  return {
    ...readAll(uid),
    uid,
    downloads: {},
    reviewLoading: false,
    sync: 'idle',
    summary: null,
    summaryPending: false,

    load: (next) => {
      if (next === get().uid) return;
      set({ ...readAll(next), uid: next, downloads: {}, reviewLoading: false, sync: 'idle', summary: null, summaryPending: false });
    },
    savePack: (kind, pack) => {
      const id = get().uid;
      if (!id) return;
      const packs = { ...get().packs, [kind]: pack };
      writeJSON(offlineKV, KEY.packs(id), packs);
      set({ packs });
    },
    removePack: (kind) => {
      const id = get().uid;
      if (!id) return;
      const packs = { ...get().packs };
      delete packs[kind];
      writeJSON(offlineKV, KEY.packs(id), packs);
      set({ packs });
    },
    prune: (key, ids) => {
      const id = get().uid;
      if (!id || ids.size === 0) return;
      if (key === 'review') {
        const review = get().review;
        if (!review) return;
        get().setReview({ ...review, puzzles: review.puzzles.filter((p) => !ids.has(p.id)) });
        return;
      }
      const pack = get().packs[key];
      if (!pack) return;
      get().savePack(key, { ...pack, puzzles: pack.puzzles.filter((p) => !ids.has(p.id)) });
    },
    setReview: (review) => {
      const id = get().uid;
      if (!id) return;
      writeJSON(offlineKV, KEY.review(id), review);
      set({ review });
    },
    enqueue: (r) => {
      const item: PendingResult = { ...r, clientId: uuidV4(randomBytes) };
      const id = get().uid;
      if (!id) return item;
      const queue = [...get().queue, item];
      writeJSON(offlineKV, KEY.queue(id), queue);
      set({ queue });
      return item;
    },
    dequeue: (ids) => {
      const id = get().uid;
      if (!id || ids.size === 0) return;
      const queue = get().queue.filter((r) => !ids.has(r.clientId));
      writeJSON(offlineKV, KEY.queue(id), queue);
      set({ queue });
    },
    setTopUp: (topUp) => {
      const id = get().uid;
      if (!id) return;
      offlineKV.set(KEY.topUp(id), topUp);
      set({ topUp });
    },
    setDownload: (kind, d) => {
      const downloads = { ...get().downloads };
      if (d) downloads[kind] = d;
      else delete downloads[kind];
      set({ downloads });
    },
    setReviewLoading: (reviewLoading) => set({ reviewLoading }),
    setSync: (sync) => set({ sync }),
    showSummary: (summary) => set({ summary, summaryPending: true }),
    ackSummary: () => set({ summaryPending: false }),
  };
});

export const offlineStore = useOfflineStore;

// Follow the signed-in account: another user sees only their own packs/queue.
authStore.subscribe((s) => {
  const next = s.user?.id ?? null;
  if (next !== offlineStore.getState().uid) offlineStore.getState().load(next);
});

// ─── Derived ─────────────────────────────────────────────────────────────

export function packOf(s: Pick<OfflineState, 'packs' | 'review'>, key: PackKey): StoredPack | null {
  return key === 'review' ? s.review : (s.packs[key] ?? null);
}

/** Puzzles of a pack still to play. */
export function unplayedOf(s: Pick<OfflineState, 'packs' | 'review' | 'queue'>, key: PackKey): OfflinePuzzle[] {
  const pack = packOf(s, key);
  return pack ? unplayed(pack.puzzles, playedIds(s.queue, key)) : [];
}

/** Bytes a pack takes in MMKV (its JSON). */
export function packBytes(pack: StoredPack | null | undefined): number {
  return pack ? JSON.stringify(pack).length : 0;
}

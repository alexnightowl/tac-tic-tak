import { formatLocalDate } from '@tac/core/format';
import { tzOffsetMinutes, uuidV4 } from '@tac/core/offline';
import {
  stormDuration,
  stormReduce,
  type StormEnd,
  type StormFormat,
  type StormRunBody,
  type StormRunSaved,
  type StormState,
} from '@tac/core/storm';
import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';

import { readJSON, writeJSON } from '@/platform/storage';
import { authStore } from '@/stores/authStore';

// Storm runs on the phone (docs/mobile/STORM.md "Rules"). Per signed-in
// user, in MMKV `storm`, written synchronously on every change:
//  - `live`: the run being played, saved after every puzzle, so a killed
//    app submits it as finished on the next launch (recoverLive);
//  - `runs`: the last finished runs with their server answer. A run with
//    no answer yet is the queue (sync.ts posts it on finish, on foreground
//    and on launch; its clientId makes every retry safe).
// Not wiped on logout, like `offline`: a queued run waits for its account.

const stormKV = createMMKV({ id: 'storm' });

/** Finished runs kept on the phone (the result screen reads them). */
const KEEP_RUNS = 20;

export type StormLive = {
  clientId: string;
  streamId: string;
  format: StormFormat;
  challengeId: string | null;
  /** The stream's puzzle ids and ratings by index (the result's chart and viewer links). */
  ids: string[];
  ratings: number[];
  state: StormState;
  /** Epoch ms of the last save (a killed run ends here). */
  savedAt: number;
};

export type StormLocalRun = {
  clientId: string;
  challengeId: string | null;
  body: StormRunBody;
  ids: string[];
  ratings: number[];
  end: StormEnd;
  /** The server's answer; null while queued. */
  saved: StormRunSaved | null;
  /** The server refused it (4xx): it leaves the queue but stays viewable. */
  rejected: boolean;
};

type Persisted = { live: StormLive | null; runs: StormLocalRun[] };

type StormStoreState = Persisted & {
  uid: string | null;
  load: (uid: string | null) => void;
  setLive: (live: StormLive | null) => void;
  /** Ends the live run into a queued local run (state must be ended). */
  finish: (live: StormLive, state: StormState) => StormLocalRun;
  markSaved: (clientId: string, saved: StormRunSaved) => void;
  markRejected: (clientId: string) => void;
};

const KEY = {
  live: (uid: string) => `${uid}.live`,
  runs: (uid: string) => `${uid}.runs`,
};

function readAll(uid: string | null): Persisted {
  if (!uid) return { live: null, runs: [] };
  return {
    live: readJSON<StormLive | null>(stormKV, KEY.live(uid), null),
    runs: readJSON<StormLocalRun[]>(stormKV, KEY.runs(uid), []),
  };
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(out);
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

export const newClientId = () => uuidV4(randomBytes);

/** The wire body of a finished run. */
export function runBody(live: StormLive, s: StormState): StormRunBody {
  const end = s.endedAt ?? Date.now();
  const startedAt = s.startedAt ?? end;
  return {
    clientId: live.clientId,
    streamId: live.streamId,
    format: live.format,
    ...(live.challengeId ? { challengeId: live.challengeId } : null),
    score: s.score,
    mistakes: s.mistakes,
    bestCombo: s.bestCombo,
    durationMs: Math.round(stormDuration(s, end)),
    lastSolveMs: Math.round(s.lastSolveMs),
    results: s.results.map((r) => ({ i: r.i, ok: r.ok, ms: Math.round(r.ms) })),
    localDay: formatLocalDate(new Date(startedAt)),
    tzOffsetMin: tzOffsetMinutes(new Date(startedAt)),
  };
}

const currentUid = () => authStore.getState().user?.id ?? null;

export const useStormStore = create<StormStoreState>((set, get) => {
  const uid = currentUid();
  const writeRuns = (runs: StormLocalRun[]) => {
    const id = get().uid;
    if (id) writeJSON(stormKV, KEY.runs(id), runs);
    set({ runs });
  };
  return {
    ...readAll(uid),
    uid,
    load: (next) => {
      if (next === get().uid) return;
      set({ ...readAll(next), uid: next });
    },
    setLive: (live) => {
      const id = get().uid;
      if (id) {
        if (live) writeJSON(stormKV, KEY.live(id), live);
        else stormKV.remove(KEY.live(id));
      }
      set({ live });
    },
    finish: (live, state) => {
      const run: StormLocalRun = {
        clientId: live.clientId,
        challengeId: live.challengeId,
        body: runBody(live, state),
        ids: live.ids,
        ratings: live.ratings,
        end: state.ended ?? 'quit',
        saved: null,
        rejected: false,
      };
      const runs = [run, ...get().runs.filter((r) => r.clientId !== run.clientId)];
      // Queued runs are never dropped, however many there are.
      const kept = runs.filter((r, i) => i < KEEP_RUNS || (!r.saved && !r.rejected));
      writeRuns(kept);
      if (get().live?.clientId === live.clientId) get().setLive(null);
      return run;
    },
    markSaved: (clientId, saved) => writeRuns(get().runs.map((r) => (r.clientId === clientId ? { ...r, saved } : r))),
    markRejected: (clientId) => writeRuns(get().runs.map((r) => (r.clientId === clientId ? { ...r, rejected: true } : r))),
  };
});

export const stormStore = useStormStore;

// Follow the signed-in account.
authStore.subscribe((s) => {
  const next = s.user?.id ?? null;
  if (next !== stormStore.getState().uid) stormStore.getState().load(next);
});

/** Runs still waiting for the server. */
export const pendingRuns = (s: Pick<StormStoreState, 'runs'>) => s.runs.filter((r) => !r.saved && !r.rejected);

/** The runner mounted right now (its live snapshot is not a leftover). */
let mountedRun: string | null = null;
export function setMountedRun(clientId: string | null): void {
  mountedRun = clientId;
}

/**
 * A live snapshot nobody is playing (the app was killed mid-run): finish it
 * where it was last saved (the clock had run out by then, or it ends as a
 * quit), or drop it when it never started.
 */
export function recoverLive(now = Date.now()): StormLocalRun | null {
  const st = stormStore.getState();
  const live = st.live;
  if (!live || live.clientId === mountedRun) return null;
  if (live.state.startedAt == null || live.state.results.length === 0) {
    st.setLive(null);
    return null;
  }
  let s = live.state;
  if (!s.ended) s = stormReduce(s, { type: 'quit', at: Math.min(now, Math.max(live.savedAt, s.puzzleAt)) });
  return st.finish(live, s);
}

import { LIBRARY_SYNC_BATCH } from '@tac/core/library';
import { tzOffsetMinutes } from '@tac/core/offline';
import { queryKeys } from '@tac/core/api';

import { readNetwork } from '@/features/offline/sync';
import { queryClient } from '@/platform/query';
import { authStore } from '@/stores/authStore';
import { isAborted } from '@/features/offline/api';
import { libraryApi, libraryKeys } from './api';
import { libraryStore } from './store';

// The Library's sync (docs/mobile/LIBRARY.md "Sync"): one run at a time;
// the offline host's triggers (start, foreground, network back) and the
// runner (after every puzzle, on exit) all join it. The queue goes first,
// then the server's list replaces the synced one (other devices' results
// arrive this way).

export type LibrarySyncReason = 'start' | 'foreground' | 'network' | 'runner' | 'manual';

let inFlight: Promise<void> | null = null;
let lastPull = 0;
/** The server list is pulled at most this often without a reason. */
const PULL_MS = 60_000;

export function requestLibrarySync(reason: LibrarySyncReason): Promise<void> {
  if (!inFlight) {
    inFlight = run(reason)
      .catch(() => undefined)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

async function run(reason: LibrarySyncReason): Promise<void> {
  if (authStore.getState().status !== 'authed') return;
  const uid = libraryStore.getState().uid;
  if (!uid) return;
  if (!(await readNetwork()).online) return;

  const flushed = await flush(uid);
  if (flushed < 0 || libraryStore.getState().uid !== uid) return;
  const exams = await flushExams(uid);
  if (exams < 0 || libraryStore.getState().uid !== uid) return;
  const due = flushed > 0 || exams > 0 || reason === 'manual' || reason === 'start' || Date.now() - lastPull > PULL_MS;
  if (!due || libraryStore.getState().queue.length > 0 || libraryStore.getState().examQueue.length > 0) return;
  try {
    const res = await libraryApi.progress();
    const s = libraryStore.getState();
    // A result queued while the pull was in flight is still in the queue;
    // the merged view keeps showing it.
    if (s.uid === uid) {
      s.setServer(res.attempts);
      // A server without courses sends no exams: keep what the phone has.
      if (res.exams) s.setServerExams(res.exams);
    }
    lastPull = Date.now();
  } catch {
    // Keep what the phone has.
  }
}

/** Posts the queue. Returns how many results left it, or -1 when a batch failed. */
async function flush(uid: string): Promise<number> {
  const store = libraryStore.getState();
  if (store.queue.length === 0) return 0;
  store.setSync('syncing');
  let moved = 0;
  let reviewAdded = 0;
  let streak = false;
  for (let i = 0; i < store.queue.length; i += LIBRARY_SYNC_BATCH) {
    const batch = store.queue.slice(i, i + LIBRARY_SYNC_BATCH);
    try {
      const res = await libraryApi.sync({ tzOffsetMin: tzOffsetMinutes(new Date()), attempts: batch });
      reviewAdded += res.reviewAdded;
      if (res.streak) streak = true;
    } catch {
      libraryStore.getState().setSync('failed');
      return -1;
    }
    if (libraryStore.getState().uid !== uid) return moved;
    libraryStore.getState().settle(batch);
    moved += batch.length;
  }
  libraryStore.getState().setSync('idle');
  void queryClient.invalidateQueries({ queryKey: queryKeys.experience() });
  if (streak) {
    // Library days count for the streak (Q47): Home and the profile show it.
    void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
  }
  if (reviewAdded > 0) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.reviewThemes() });
    void queryClient.invalidateQueries({ queryKey: ['review-list'] });
  }
  return moved;
}

/** Posts the queued exam tries (one small request). Returns how many left the queue, or -1. */
async function flushExams(uid: string): Promise<number> {
  const queue = libraryStore.getState().examQueue;
  if (queue.length === 0) return 0;
  try {
    await libraryApi.sync({ tzOffsetMin: tzOffsetMinutes(new Date()), attempts: [], exams: queue });
  } catch {
    libraryStore.getState().setSync('failed');
    return -1;
  }
  if (libraryStore.getState().uid !== uid) return 0;
  libraryStore.getState().settleExams(queue);
  return queue.length;
}

// ─── Shelf and downloads ─────────────────────────────────────────────────

/** GET /library/books into the stored shelf; a downloaded book with a newer version is fetched again. */
export async function refreshShelf(): Promise<void> {
  const res = await libraryApi.books();
  const s = libraryStore.getState();
  s.setShelf(res.books);
  queryClient.setQueryData(libraryKeys.books(), res);
  for (const b of res.books) {
    const have = s.books[b.id];
    if (have && have.version < b.version) void downloadBook(b.id);
  }
}

const controllers = new Map<string, AbortController>();

export type DownloadResult = 'ok' | 'offline' | 'error' | 'cancelled' | 'busy';

export async function downloadBook(id: string): Promise<DownloadResult> {
  const s = libraryStore.getState();
  if (s.downloads[id] === 'loading') return 'busy';
  if (!(await readNetwork()).online) {
    s.setDownload(id, 'offline');
    return 'offline';
  }
  const ctrl = new AbortController();
  controllers.set(id, ctrl);
  s.setDownload(id, 'loading');
  try {
    const book = await libraryApi.book(id, ctrl.signal);
    libraryStore.getState().saveBook(book);
    queryClient.setQueryData(libraryKeys.book(id), book);
    libraryStore.getState().setDownload(id, null);
    return 'ok';
  } catch (e) {
    if (isAborted(e)) {
      libraryStore.getState().setDownload(id, null);
      return 'cancelled';
    }
    libraryStore.getState().setDownload(id, 'error');
    return 'error';
  } finally {
    if (controllers.get(id) === ctrl) controllers.delete(id);
  }
}

export function cancelBookDownload(id: string): void {
  controllers.get(id)?.abort();
}

// ─── Courses ─────────────────────────────────────────────────────────────

/** GET /library/courses into the stored list; a downloaded course with a newer version is fetched again. */
export async function refreshCourses(): Promise<void> {
  const res = await libraryApi.courses();
  const s = libraryStore.getState();
  s.setCourseList(res.courses);
  queryClient.setQueryData(libraryKeys.courses(), res);
  for (const c of res.courses) {
    const have = s.courses[c.id];
    if (have && have.version < c.version) void downloadCourse(c.id);
  }
}

/** Course ids and book ids never collide, so both share the download states. */
export async function downloadCourse(id: string): Promise<DownloadResult> {
  const s = libraryStore.getState();
  if (s.downloads[id] === 'loading') return 'busy';
  if (!(await readNetwork()).online) {
    s.setDownload(id, 'offline');
    return 'offline';
  }
  const ctrl = new AbortController();
  controllers.set(id, ctrl);
  s.setDownload(id, 'loading');
  try {
    const course = await libraryApi.course(id, ctrl.signal);
    libraryStore.getState().saveCourse(course);
    queryClient.setQueryData(libraryKeys.course(id), course);
    libraryStore.getState().setDownload(id, null);
    return 'ok';
  } catch (e) {
    if (isAborted(e)) {
      libraryStore.getState().setDownload(id, null);
      return 'cancelled';
    }
    libraryStore.getState().setDownload(id, 'error');
    return 'error';
  } finally {
    if (controllers.get(id) === ctrl) controllers.delete(id);
  }
}

export const cancelCourseDownload = cancelBookDownload;

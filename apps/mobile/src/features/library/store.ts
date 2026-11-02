import { uuidV4 } from '@tac/core/offline';
import {
  mergeAttempts,
  type Course,
  type CourseExamRecord,
  type CoursePendingExam,
  type CourseSummary,
  type LibraryAttemptRecord,
  type LibraryBook,
  type LibraryBookSummary,
  type LibraryPendingAttempt,
} from '@tac/core/library';
import { useMemo } from 'react';
import { create } from 'zustand';

import { libraryKV, readJSON, writeJSON } from '@/platform/storage';
import { authStore } from '@/stores/authStore';

// The Library on the phone (docs/mobile/LIBRARY.md). Every result is
// queued in MMKV first, synchronously, and leaves the queue only after
// POST /library/sync answered 2xx, so a kill or a dead network never
// loses one; the server dedupes a re-send. Downloaded books are shared by
// the accounts on the phone; results are per user. Courses (Learn tab)
// share all of it: their results are attempts with bookId = the course id,
// and exam tries have a queue of their own.

export type DownloadState = 'loading' | 'error' | 'offline';
export type SyncStatus = 'idle' | 'syncing' | 'failed';

type Persisted = {
  shelf: LibraryBookSummary[] | null;
  books: Record<string, LibraryBook>;
  server: LibraryAttemptRecord[];
  queue: LibraryPendingAttempt[];
  courseList: CourseSummary[] | null;
  courses: Record<string, Course>;
  serverExams: CourseExamRecord[];
  examQueue: CoursePendingExam[];
};

type LibraryState = Persisted & {
  uid: string | null;
  downloads: Record<string, DownloadState>;
  sync: SyncStatus;

  load: (uid: string | null) => void;
  setShelf: (books: LibraryBookSummary[]) => void;
  saveBook: (book: LibraryBook) => void;
  removeBook: (id: string) => void;
  setServer: (attempts: LibraryAttemptRecord[]) => void;
  enqueue: (r: Omit<LibraryPendingAttempt, 'clientId'>) => LibraryPendingAttempt;
  /** Synced results move from the queue to the server list in one write. */
  settle: (sent: readonly LibraryPendingAttempt[]) => void;
  setDownload: (id: string, d: DownloadState | null) => void;
  setSync: (s: SyncStatus) => void;

  setCourseList: (courses: CourseSummary[]) => void;
  saveCourse: (course: Course) => void;
  removeCourse: (id: string) => void;
  setServerExams: (exams: CourseExamRecord[]) => void;
  enqueueExam: (e: Omit<CoursePendingExam, 'clientId'>) => CoursePendingExam;
  settleExams: (sent: readonly CoursePendingExam[]) => void;
};

const KEY = {
  shelf: 'shelf',
  book: (id: string) => `book.${id}`,
  bookIds: 'books',
  server: (uid: string) => `${uid}.server`,
  queue: (uid: string) => `${uid}.queue`,
  courseList: 'courses',
  course: (id: string) => `course.${id}`,
  courseIds: 'courseIds',
  serverExams: (uid: string) => `${uid}.exams`,
  examQueue: (uid: string) => `${uid}.examQueue`,
};

function readBooks(): Record<string, LibraryBook> {
  const ids = readJSON<string[]>(libraryKV, KEY.bookIds, []);
  const out: Record<string, LibraryBook> = {};
  for (const id of ids) {
    const b = readJSON<LibraryBook | null>(libraryKV, KEY.book(id), null);
    if (b) out[id] = b;
  }
  return out;
}

function readCourses(): Record<string, Course> {
  const ids = readJSON<string[]>(libraryKV, KEY.courseIds, []);
  const out: Record<string, Course> = {};
  for (const id of ids) {
    const c = readJSON<Course | null>(libraryKV, KEY.course(id), null);
    if (c) out[id] = c;
  }
  return out;
}

function readUser(uid: string | null): Pick<Persisted, 'server' | 'queue' | 'serverExams' | 'examQueue'> {
  if (!uid) return { server: [], queue: [], serverExams: [], examQueue: [] };
  return {
    server: readJSON<LibraryAttemptRecord[]>(libraryKV, KEY.server(uid), []),
    queue: readJSON<LibraryPendingAttempt[]>(libraryKV, KEY.queue(uid), []),
    serverExams: readJSON<CourseExamRecord[]>(libraryKV, KEY.serverExams(uid), []),
    examQueue: readJSON<CoursePendingExam[]>(libraryKV, KEY.examQueue(uid), []),
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

export const useLibraryStore = create<LibraryState>((set, get) => {
  const uid = currentUid();
  return {
    shelf: readJSON<LibraryBookSummary[] | null>(libraryKV, KEY.shelf, null),
    books: readBooks(),
    courseList: readJSON<CourseSummary[] | null>(libraryKV, KEY.courseList, null),
    courses: readCourses(),
    ...readUser(uid),
    uid,
    downloads: {},
    sync: 'idle',

    load: (next) => {
      if (next === get().uid) return;
      set({ ...readUser(next), uid: next, sync: 'idle' });
    },
    setShelf: (shelf) => {
      writeJSON(libraryKV, KEY.shelf, shelf);
      set({ shelf });
    },
    saveBook: (book) => {
      writeJSON(libraryKV, KEY.book(book.id), book);
      const books = { ...get().books, [book.id]: book };
      writeJSON(libraryKV, KEY.bookIds, Object.keys(books));
      set({ books });
    },
    removeBook: (id) => {
      libraryKV.remove(KEY.book(id));
      const books = { ...get().books };
      delete books[id];
      writeJSON(libraryKV, KEY.bookIds, Object.keys(books));
      set({ books });
    },
    setServer: (server) => {
      const id = get().uid;
      if (!id) return;
      writeJSON(libraryKV, KEY.server(id), server);
      set({ server });
    },
    enqueue: (r) => {
      const item: LibraryPendingAttempt = { ...r, clientId: uuidV4(randomBytes) };
      const id = get().uid;
      if (!id) return item;
      const queue = [...get().queue, item];
      writeJSON(libraryKV, KEY.queue(id), queue);
      set({ queue });
      return item;
    },
    settle: (sent) => {
      const id = get().uid;
      if (!id || sent.length === 0) return;
      const ids = new Set(sent.map((r) => r.clientId));
      const records = sent.map(({ clientId: _c, localDay: _d, ...r }) => r);
      const server = mergeAttempts(get().server, records);
      const queue = get().queue.filter((r) => !ids.has(r.clientId));
      // Server list first: a crash in between re-sends a deduped result.
      writeJSON(libraryKV, KEY.server(id), server);
      writeJSON(libraryKV, KEY.queue(id), queue);
      set({ server, queue });
    },
    setDownload: (bookId, d) => {
      const downloads = { ...get().downloads };
      if (d) downloads[bookId] = d;
      else delete downloads[bookId];
      set({ downloads });
    },
    setSync: (sync) => set({ sync }),

    setCourseList: (courseList) => {
      writeJSON(libraryKV, KEY.courseList, courseList);
      set({ courseList });
    },
    saveCourse: (course) => {
      writeJSON(libraryKV, KEY.course(course.id), course);
      const courses = { ...get().courses, [course.id]: course };
      writeJSON(libraryKV, KEY.courseIds, Object.keys(courses));
      set({ courses });
    },
    removeCourse: (id) => {
      libraryKV.remove(KEY.course(id));
      const courses = { ...get().courses };
      delete courses[id];
      writeJSON(libraryKV, KEY.courseIds, Object.keys(courses));
      set({ courses });
    },
    setServerExams: (serverExams) => {
      const id = get().uid;
      if (!id) return;
      writeJSON(libraryKV, KEY.serverExams(id), serverExams);
      set({ serverExams });
    },
    enqueueExam: (e) => {
      const item: CoursePendingExam = { ...e, clientId: uuidV4(randomBytes) };
      const id = get().uid;
      if (!id) return item;
      const examQueue = [...get().examQueue, item];
      writeJSON(libraryKV, KEY.examQueue(id), examQueue);
      set({ examQueue });
      return item;
    },
    settleExams: (sent) => {
      const id = get().uid;
      if (!id || sent.length === 0) return;
      const ids = new Set(sent.map((e) => e.clientId));
      const serverExams = [...get().serverExams, ...sent.map(({ clientId: _c, ...e }) => e)];
      const examQueue = get().examQueue.filter((e) => !ids.has(e.clientId));
      writeJSON(libraryKV, KEY.serverExams(id), serverExams);
      writeJSON(libraryKV, KEY.examQueue(id), examQueue);
      set({ serverExams, examQueue });
    },
  };
});

export const libraryStore = useLibraryStore;

// Follow the signed-in account: another user sees only their own results.
authStore.subscribe((s) => {
  const next = s.user?.id ?? null;
  if (next !== libraryStore.getState().uid) libraryStore.getState().load(next);
});

/** Every result of the player: synced and queued, first per puzzle and cycle. */
export function attemptsOf(s: Pick<LibraryState, 'server' | 'queue'>): LibraryAttemptRecord[] {
  return mergeAttempts(s.server, s.queue);
}

/** Every exam try of the player: synced, then queued (a queued one is not on the server yet). */
export function examsOf(s: Pick<LibraryState, 'serverExams' | 'examQueue'>): CourseExamRecord[] {
  const seen = new Set(s.serverExams.map((e) => `${e.courseId}|${e.takenAt}`));
  return [...s.serverExams, ...s.examQueue.filter((e) => !seen.has(`${e.courseId}|${e.takenAt}`)).map(({ clientId: _c, ...e }) => e)];
}

/** examsOf for a component. */
export function useExams(): CourseExamRecord[] {
  const serverExams = useLibraryStore((s) => s.serverExams);
  const examQueue = useLibraryStore((s) => s.examQueue);
  return useMemo(() => examsOf({ serverExams, examQueue }), [serverExams, examQueue]);
}

/** Bytes a stored book takes (its JSON). */
export const bookBytes = (b: LibraryBook | undefined) => (b ? JSON.stringify(b).length : 0);

/** attemptsOf for a component: recomputed only when either list changes. */
export function useAttempts(): LibraryAttemptRecord[] {
  const server = useLibraryStore((s) => s.server);
  const queue = useLibraryStore((s) => s.queue);
  return useMemo(() => mergeAttempts(server, queue), [server, queue]);
}

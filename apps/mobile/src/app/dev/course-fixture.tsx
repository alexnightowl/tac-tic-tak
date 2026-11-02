import type { Course, CourseExamRecord, CourseSummary, LibraryAttemptRecord } from '@tac/core/library';
import { eos, fontFamilies } from '@tac/core/tokens';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useLibraryStore } from '@/features/library/store';

// DEV ONLY: a real-puzzle "basic" course (Lichess puzzles from the local
// DB, version 0 so the server's copy replaces it once the backend serves
// courses) stored as downloaded, plus seeded results for every course
// page state. Seeds write the phone's copy of the server list only; a
// later pull from a server without these results drops them again.
//   tactictak://dev/course-fixture?seed=new|progress|examopen|failed|passed|cycle2[&open=1]

const fixture = (): Course => require('../../dev/courseFixture.json') as Course;

const SEEDS = ['new', 'progress', 'examopen', 'failed', 'passed', 'cycle2'] as const;
type Seed = (typeof SEEDS)[number];

function summaryOf(c: Course): CourseSummary {
  return {
    ...c,
    chapters: c.chapters.map(({ intro: _i, puzzles: _p, ...ch }) => ch),
    exam: { id: c.exam.id, count: c.exam.count, passMark: c.exam.passMark, puzzleIds: c.exam.puzzleIds },
  };
}

const DAY = 24 * 3600 * 1000;

function seed(kind: Seed) {
  const c = fixture();
  const s = useLibraryStore.getState();
  s.saveCourse(c);
  const list = (s.courseList ?? []).filter((x) => x.id !== c.id);
  s.setCourseList([summaryOf(c), ...list]);

  const out: LibraryAttemptRecord[] = [];
  const exams: CourseExamRecord[] = [];
  const at = (daysAgo: number, i: number) => new Date(Date.now() - daysAgo * DAY + i * 60_000).toISOString();
  const chapter = (ch: number, cycle: number, n: number, sec: number, daysAgo: number, miss = -1) => {
    c.chapters[ch].puzzleIds.slice(0, n).forEach((puzzleId, i) =>
      out.push({ bookId: c.id, puzzleId, cycle, result: i === miss ? 'missed' : 'clean', timeMs: (sec + ((i * 7) % 11) - 5) * 1000, solvedAt: at(daysAgo, ch * 20 + i) }),
    );
  };
  const examTry = (cycle: number, score: number, daysAgo: number, attempts: boolean) => {
    const byTheme: Record<string, [number, number]> = {};
    let right = 0;
    c.exam.puzzles.forEach((p, i) => {
      const row = (byTheme[p.theme] ??= [0, 0]);
      // Misses land on pin and skewer first: "Weakest: Pin, Skewer".
      const weak = p.theme === 'pin' || p.theme === 'skewer';
      const ok = right < score && !(weak && row[0] >= 1 && score < c.exam.passMark);
      if (ok) right++;
      row[1]++;
      if (ok) row[0]++;
      if (attempts) out.push({ bookId: c.id, puzzleId: p.id, cycle, result: ok ? 'clean' : 'missed', timeMs: 30000, solvedAt: at(daysAgo, 400 + i) });
    });
    exams.push({ courseId: c.id, cycle, score: right, total: c.exam.count, passed: right >= c.exam.passMark, byTheme, takenAt: at(daysAgo, 500) });
  };

  if (kind === 'progress') {
    chapter(0, 1, 15, 38, 3);
    chapter(1, 1, 15, 29, 2);
    chapter(2, 1, 6, 41, 1);
  }
  if (kind === 'examopen' || kind === 'failed' || kind === 'passed' || kind === 'cycle2') {
    for (let ch = 0; ch < c.chapters.length; ch++) chapter(ch, 1, 15, 41 - ch, 12 - ch, ch === 3 ? 4 : -1);
  }
  if (kind === 'failed') examTry(1, 21, 1, true);
  if (kind === 'passed' || kind === 'cycle2') examTry(1, 27, 1, true);
  if (kind === 'cycle2') {
    for (let ch = 0; ch < 6; ch++) chapter(ch, 2, 15, 24, 0.5);
    chapter(6, 2, 4, 26, 0.2);
  }

  pinned = { courseId: c.id, attempts: out, exams };
  apply();
}

// A pull from a server without these results replaces the phone's copy:
// the seed stays pinned (this session) and is put back after each pull.
let pinned: { courseId: string; attempts: LibraryAttemptRecord[]; exams: CourseExamRecord[] } | null = null;
let applying = false;

function apply() {
  if (!pinned || applying) return;
  applying = true;
  const s = useLibraryStore.getState();
  const { courseId, attempts, exams } = pinned;
  s.setServer([...s.server.filter((a) => a.bookId !== courseId), ...attempts]);
  s.setServerExams([...s.serverExams.filter((e) => e.courseId !== courseId), ...exams]);
  applying = false;
}

useLibraryStore.subscribe((s, prev) => {
  if (!pinned || applying) return;
  if (s.server !== prev.server && pinned.attempts.length > 0 && !s.server.some((a) => a.bookId === pinned?.courseId)) apply();
  else if (s.serverExams !== prev.serverExams && pinned.exams.length > 0 && !s.serverExams.some((e) => e.courseId === pinned?.courseId)) apply();
});

export default function CourseFixtureLab() {
  const p = useLocalSearchParams<{ seed?: string; open?: string }>();
  const mine = useLibraryStore((s) => s.server.filter((a) => a.bookId === 'basic').length);
  const uid = useLibraryStore((s) => s.uid);
  useEffect(() => {
    const k = SEEDS.find((x) => x === p.seed);
    if (!k) return;
    seed(k);
    if (p.open) router.replace(`/course/${fixture().id}` as Href);
  }, [p.seed, p.open]);
  return (
    <ScrollView contentContainerStyle={styles.list} testID="dev-course-fixture">
      <Stack.Screen options={{ title: 'Course fixture' }} />
      <Text style={styles.title} testID="dev-course-count">{`uid ${uid ? 'yes' : 'no'} · basic results ${mine}`}</Text>
      {SEEDS.map((k) => (
        <Pressable
          key={k}
          style={styles.row}
          testID={`dev-course-seed-${k}`}
          onPress={() => {
            seed(k);
            router.push(`/course/${fixture().id}` as Href);
          }}
        >
          <Text style={styles.title}>{k}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  row: { backgroundColor: eos.slate, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: eos.seam },
  title: { color: eos.bone, fontSize: 16, fontFamily: fontFamilies.sans[700] },
});

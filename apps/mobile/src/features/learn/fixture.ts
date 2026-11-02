import type { CourseExamRecord, CourseSummary, LibraryAttemptRecord } from '@tac/core/library';

// DEV ONLY: the four courses of the owner's table, shaped like GET
// /library/courses, for building and screenshotting the Learn tab before
// the backend serves the catalogue. LearnScreen uses it only in __DEV__
// and only while the API has no course list. The demo results give the
// canvas states (Basic passed 27/30, Intermediate 51 of 165, the others
// untouched) and run through the real courseProgress.

type Row = [id: string, en: string, uk: string, color: string, piece: CourseSummary['piece'], min: number, max: number, suggest: boolean, themes: string[]];

const ROWS: Row[] = [
  ['basic', 'Basic', 'Базовий', '#8e4542', 'pawn', 400, 1400, true, ['hangingPiece', 'mateIn1', 'fork', 'pin', 'skewer', 'discoveredAttack', 'backRankMate', 'trappedPiece', 'capturingDefender', 'mateIn2']],
  ['intermediate', 'Intermediate', 'Середній', '#c98c55', 'knight', 1100, 1900, true, ['attraction', 'deflection', 'doubleCheck', 'intermezzo', 'clearance', 'interference', 'attackingF2F7', 'promotion', 'defensiveMove', 'smotheredMate', 'mateIn3']],
  ['advanced', 'Advanced', 'Просунутий', '#cbbfae', 'queen', 1800, 2600, true, ['quietMove', 'xRayAttack', 'zugzwang', 'kingsideAttack', 'veryLong', 'defensiveMove', 'mateIn4']],
  ['endgames', 'Endgames', 'Ендшпіль', '#94a58e', 'king', 800, 2300, false, ['pawnEndgame', 'rookEndgame', 'knightEndgame', 'bishopEndgame', 'queenEndgame', 'queenRookEndgame', 'promotion']],
];

const t = (s: string) => ({ en: s, uk: s });

export const FIXTURE_COURSES: CourseSummary[] = ROWS.map(([id, en, uk, color, piece, ratingMin, ratingMax, suggest, themes]) => ({
  id: `fx-${id}`,
  version: 1,
  title: { en, uk },
  description: t(''),
  color,
  piece,
  ratingMin,
  ratingMax,
  suggest,
  puzzleCount: themes.length * 15 + 30,
  minutesPerCycle: themes.length * 15,
  chapters: themes.map((theme, i) => ({
    id: `fx-${id}-${i + 1}`,
    theme,
    title: t(theme),
    tip: t(''),
    count: 15,
    puzzleIds: Array.from({ length: 15 }, (_, j) => `fx-${id}-${i + 1}-${j + 1}`),
  })),
  exam: { id: `fx-${id}-exam`, count: 30, passMark: 24, puzzleIds: Array.from({ length: 30 }, (_, j) => `fx-${id}-x-${j + 1}`) },
}));

function results(c: CourseSummary, n: number, cycle: number, day: number): LibraryAttemptRecord[] {
  return c.chapters
    .flatMap((ch) => ch.puzzleIds)
    .slice(0, n)
    .map((puzzleId, i) => ({ bookId: c.id, puzzleId, cycle, result: 'clean', timeMs: 40_000, solvedAt: new Date(Date.UTC(2026, 10, day, 10, 0, i)).toISOString() }));
}

const [basic, intermediate] = FIXTURE_COURSES;

export const FIXTURE_ATTEMPTS: LibraryAttemptRecord[] = [...results(basic, 150, 1, 1), ...results(intermediate, 51, 1, 2)];

export const FIXTURE_EXAMS: CourseExamRecord[] = [
  { courseId: basic.id, cycle: 1, score: 27, total: 30, passed: true, byTheme: {}, takenAt: '2026-11-01T11:00:00.000Z' },
];

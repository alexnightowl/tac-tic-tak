// dxlearn area, en: desktop web screens (canvas page "Desktop — redesign", DX*
// artboards). Keys start with 'dx.learn.'; reuse existing keys first.
import type { Dict } from '../types';

export const dxlearnEn: Dict = {
  // Learn (DXLearn / DXBooks).
  'dx.learn.books_subtitle': 'Classic collections, solved in cycles',
  'dx.learn.chapters_exam.one': '{n} chapter + exam',
  'dx.learn.chapters_exam.other': '{n} chapters + exam',
  'dx.learn.chapters_exam.few': '{n} chapters + exam',
  'dx.learn.chapters_exam.many': '{n} chapters + exam',
  'dx.learn.chapter_of': 'Chapter {n} of {total}',
  'dx.learn.not_started': 'Not started',
  'dx.learn.search': 'Title or author',
  'dx.learn.search_a11y': 'Search books by title or author',
  'dx.learn.no_match': 'No book matches.',
  // Course page (DXCourse).
  'dx.learn.stat.chapters': 'chapters',
  'dx.learn.stat.puzzles': 'puzzles',
  'dx.learn.stat.cycle': 'per cycle',
  'dx.learn.chapters_done': '{done} of {total} done · any order',
  'dx.learn.cycle_first_note': 'First pass — no time limit. Cycle 2 — the same positions, 30% faster.',
  'dx.learn.cycle_target_note': 'The same positions again: aim for {s} s a puzzle.',
  'dx.learn.cycle_free_note': 'The same positions again, faster than last time.',
  'dx.learn.exam_meta': '{count} · pass mark {pass}',
  'dx.learn.cycle_pill_done': '{n} · {s} s',
  'dx.learn.cycle_pill_target': '{n} · target {s} s',
  'dx.learn.cycle_pill_first': '{n} · first pass',
  'dx.learn.cycle_pill_later': '{n} · —',
  // Chapter intro (DXChapterIntro).
  'dx.learn.back_course': 'Course',
  'dx.learn.intro_note': 'Shown before the first pass · later cycles can skip it',
  // Review (DXReview).
  'dx.learn.review_hint': 'Easy to hard · every right answer takes the puzzle off the queue',
  'dx.learn.review_all': 'Review all',
  'dx.learn.by_theme': 'By theme',
  'dx.learn.sort_a11y': 'Sort themes',
  'dx.learn.sort.most': 'Most',
  'dx.learn.sort.hardest': 'Hardest',
  'dx.learn.mistakes.one': '{n} mistake',
  'dx.learn.mistakes.other': '{n} mistakes',
  'dx.learn.mistakes.few': '{n} mistakes',
  'dx.learn.mistakes.many': '{n} mistakes',
  'dx.learn.no_mistakes': 'No mistakes',
  'dx.learn.session_a11y': '{title}, {when}, {mistakes}',
  'dx.learn.mistakes_a11y': 'Review the mistakes of this session',
  'dx.learn.history_empty': 'No sessions yet.',
  'dx.learn.refresh_a11y': 'Refresh',
};

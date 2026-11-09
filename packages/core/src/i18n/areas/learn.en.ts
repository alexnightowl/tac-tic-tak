// learn area, en (docs/mobile/COURSES.md, canvas page "Learn"). Mobile-only; no web keys.
import type { Dict } from '../types';

export const learnEn: Dict = {
  // Tab bar.
  'learn.tab': 'Learn',
  // Play: the Review row (app-only; Review left the tab bar).
  'learn.review_entry.hint': 'Your missed puzzles, by theme',
  'learn.review_entry.empty': 'Nothing waiting. Misses land here.',
  'learn.review_entry.waiting.one': '{n} puzzle waiting',
  'learn.review_entry.waiting.other': '{n} puzzles waiting',
  'learn.review_entry.waiting.few': '{n} puzzles waiting',
  'learn.review_entry.waiting.many': '{n} puzzles waiting',
  // Learn screen (canvas LearnHome / LearnBooks).
  'learn.title': 'Learn',
  'learn.subtitle': 'Calm study. Nothing here touches your level.',
  'learn.segment.courses': 'Courses',
  'learn.segment.books': 'Books',
  'learn.segments_a11y': 'Learn sections',
  'learn.continue': 'Continue',
  'learn.course.chapter_line': 'Ch. {n} · {title} · {done} of {total}',
  'learn.course.exam_line': 'Final exam',
  'learn.course.continue_cycle': 'Continue · cycle {n}',
  'learn.course.start_cycle': 'Start cycle {n}',
  'learn.suggest': 'At level {rating} we suggest {course}.',
  'learn.course_a11y': '{title}, {range}, {status}',
  'learn.filter.all': 'All',
  'learn.filter.progress': 'In progress',
  'learn.filter.downloaded': 'Downloaded',
  'learn.filter.finished': 'Finished',
  'learn.empty_courses': 'No courses here yet.',
  'learn.load_failed': 'Couldn’t load the courses.',

  // Course card status (LearnStates "Course card").
  'learn.status.remote': 'Not downloaded · {count}',
  'learn.status.downloading': 'Downloading…',
  'learn.status.fresh': 'On this phone · not started',
  'learn.status.progress': '{done} of {total} · cycle {n}',
  'learn.status.passed': 'Passed · exam {score}/{total}',
  'learn.status.cycle': 'Cycle {n} · {done} of {total} · target {s} s',
  'learn.status.cycle_free': 'Cycle {n} · {done} of {total}',

  // Open-book transition: the first page.
  'learn.open.chapter': 'Chapter',
};

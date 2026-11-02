// learn area, uk (docs/mobile/COURSES.md, canvas page "Learn"). Mobile-only; no web keys.
import type { Dict } from '../types';

export const learnUk: Dict = {
  // Tab bar.
  'learn.tab': 'Навчання',
  // Play: the Review row (app-only; Review left the tab bar).
  'learn.review_entry.hint': 'Ваші помилки, за темами',
  'learn.review_entry.empty': 'Нічого не чекає. Помилки потрапляють сюди.',
  'learn.review_entry.waiting.one': '{n} задача чекає',
  'learn.review_entry.waiting.few': '{n} задачі чекають',
  'learn.review_entry.waiting.many': '{n} задач чекають',
  'learn.review_entry.waiting.other': '{n} задачі чекають',
  // Learn screen (canvas LearnHome / LearnBooks).
  'learn.title': 'Навчання',
  'learn.subtitle': 'Спокійне навчання. Тут ніщо не впливає на ваш рейтинг.',
  'learn.segment.courses': 'Курси',
  'learn.segment.books': 'Книги',
  'learn.segments_a11y': 'Розділи навчання',
  'learn.continue': 'Продовжити',
  'learn.course.chapter_line': 'Розд. {n} · {title} · {done} з {total}',
  'learn.course.exam_line': 'Підсумковий іспит',
  'learn.course.continue_cycle': 'Продовжити · цикл {n}',
  'learn.course.start_cycle': 'Почати цикл {n}',
  'learn.suggest': 'З рейтингом {rating} радимо курс {course}.',
  'learn.course_a11y': '{title}, {range}, {status}',
  'learn.filter.all': 'Усі',
  'learn.filter.progress': 'У процесі',
  'learn.filter.downloaded': 'Завантажені',
  'learn.filter.finished': 'Завершені',
  'learn.empty_courses': 'Тут поки немає курсів.',
  'learn.load_failed': 'Не вдалося завантажити курси.',

  // Course card status (LearnStates "Course card").
  'learn.status.remote': 'Не завантажено · {count}',
  'learn.status.downloading': 'Завантаження…',
  'learn.status.fresh': 'На телефоні · не розпочато',
  'learn.status.progress': '{done} з {total} · цикл {n}',
  'learn.status.passed': 'Складено · іспит {score}/{total}',
  'learn.status.cycle': 'Цикл {n} · {done} з {total} · ціль {s} с',
  'learn.status.cycle_free': 'Цикл {n} · {done} з {total}',

  // Open-book transition: the first page.
  'learn.open.chapter': 'Розділ',
};

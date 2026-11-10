// learn area, ru (docs/mobile/COURSES.md, canvas page "Learn"). Mobile-only; no web keys.
import type { Dict } from '../types';

export const learnRu: Dict = {
  // Tab bar.
  'learn.tab': 'Обучение',
  // Play: the Review row (app-only; Review left the tab bar).
  'learn.review_entry.hint': 'Твои ошибки, по темам',
  'learn.review_entry.empty': 'Ничего не ждет. Ошибки попадают сюда.',
  'learn.review_entry.waiting.one': '{n} задача ждет',
  'learn.review_entry.waiting.few': '{n} задачи ждут',
  'learn.review_entry.waiting.many': '{n} задач ждут',
  'learn.review_entry.waiting.other': '{n} задачи ждут',
  // Learn screen (canvas LearnHome / LearnBooks).
  'learn.title': 'Обучение',
  'learn.subtitle': 'Спокойная учеба. Здесь ничто не влияет на твой уровень.',
  'learn.segment.courses': 'Курсы',
  'learn.segment.books': 'Книги',
  'learn.segments_a11y': 'Разделы обучения',
  'learn.continue': 'Продолжить',
  'learn.course.chapter_line': 'Гл. {n} · {title} · {done} из {total}',
  'learn.course.exam_line': 'Итоговый экзамен',
  'learn.course.continue_cycle': 'Продолжить · круг {n}',
  'learn.course.start_cycle': 'Начать круг {n}',
  'learn.suggest': 'На уровне {rating} советуем курс {course}.',
  'learn.course_a11y': '{title}, {range}, {status}',
  'learn.filter.all': 'Все',
  'learn.filter.progress': 'В процессе',
  'learn.filter.downloaded': 'Скачанные',
  'learn.filter.finished': 'Завершенные',
  'learn.empty_courses': 'Здесь пока нет курсов.',
  'learn.load_failed': 'Не удалось загрузить курсы.',

  // Course card status (LearnStates "Course card").
  'learn.status.remote': 'Не скачан · {count}',
  'learn.status.downloading': 'Скачивается…',
  'learn.status.fresh': 'На телефоне · не начат',
  'learn.status.progress': '{done} из {total} · круг {n}',
  'learn.status.passed': 'Сдан · экзамен {score}/{total}',
  'learn.status.cycle': 'Круг {n} · {done} из {total} · цель {s} с',
  'learn.status.cycle_free': 'Круг {n} · {done} из {total}',

  // Open-book transition: the first page.
  'learn.open.chapter': 'Глава',
};

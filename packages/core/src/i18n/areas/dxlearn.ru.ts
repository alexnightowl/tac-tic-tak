// dxlearn area, ru: desktop web screens (canvas page "Desktop — redesign", DX*
// artboards). Keys start with 'dx.learn.'; reuse existing keys first.
import type { Dict } from '../types';

export const dxlearnRu: Dict = {
  // Learn (DXLearn / DXBooks).
  'dx.learn.books_subtitle': 'Классические сборники, которые решают кругами',
  'dx.learn.suggest': 'С уровнем {level} советуем курс {course}.',
  'dx.learn.chapters_exam.one': '{n} глава + экзамен',
  'dx.learn.chapters_exam.few': '{n} главы + экзамен',
  'dx.learn.chapters_exam.many': '{n} глав + экзамен',
  'dx.learn.chapters_exam.other': '{n} главы + экзамен',
  'dx.learn.chapter_of': 'Глава {n} из {total}',
  'dx.learn.not_started': 'Не начато',
  'dx.learn.search': 'Название или автор',
  'dx.learn.search_a11y': 'Поиск книг по названию или автору',
  'dx.learn.no_match': 'Ни одна книга не подходит.',
  // Course page (DXCourse).
  'dx.learn.stat.chapters': 'главы',
  'dx.learn.stat.puzzles': 'задач',
  'dx.learn.stat.cycle': 'за круг',
  'dx.learn.chapters_done': '{done} из {total} пройдено · в любом порядке',
  'dx.learn.cycle_first_note': 'Первый проход — без лимита времени. Круг 2 — те же позиции, на 30% быстрее.',
  'dx.learn.cycle_target_note': 'Те же позиции еще раз: цель — {s} с на задачу.',
  'dx.learn.cycle_free_note': 'Те же позиции еще раз — быстрее, чем в прошлый раз.',
  'dx.learn.exam_meta': '{count} · проходной {pass}',
  'dx.learn.cycle_pill_done': '{n} · {s} с',
  'dx.learn.cycle_pill_target': '{n} · цель {s} с',
  'dx.learn.cycle_pill_first': '{n} · первый',
  'dx.learn.cycle_pill_later': '{n} · —',
  // Chapter intro (DXChapterIntro).
  'dx.learn.back_course': 'Курс',
  'dx.learn.intro_note': 'Показывается перед первым проходом · в следующих кругах можно пропустить',
  // Review (DXReview).
  'dx.learn.review_hint': 'От легких к сложным · каждый верный ответ убирает задачу из очереди',
  'dx.learn.review_all': 'Разобрать все',
  'dx.learn.by_theme': 'По темам',
  'dx.learn.sort_a11y': 'Сортировка тем',
  'dx.learn.sort.most': 'Больше всего',
  'dx.learn.sort.hardest': 'Самые сложные',
  'dx.learn.mistakes.one': '{n} ошибка',
  'dx.learn.mistakes.few': '{n} ошибки',
  'dx.learn.mistakes.many': '{n} ошибок',
  'dx.learn.mistakes.other': '{n} ошибки',
  'dx.learn.no_mistakes': 'Без ошибок',
  'dx.learn.session_a11y': '{title}, {when}, {mistakes}',
  'dx.learn.mistakes_a11y': 'Разобрать ошибки этой сессии',
  'dx.learn.history_empty': 'Сессий пока нет.',
  'dx.learn.refresh_a11y': 'Обновить',
};

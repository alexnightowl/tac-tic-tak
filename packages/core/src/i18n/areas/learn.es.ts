// learn area, es (docs/mobile/COURSES.md, canvas page "Learn"). Mobile-only; no web keys.
import type { Dict } from '../types';

export const learnEs: Dict = {
  // Tab bar.
  'learn.tab': 'Aprender',
  // Play: the Review row (app-only; Review left the tab bar).
  'learn.review_entry.hint': 'Tus problemas fallados, por tema',
  'learn.review_entry.empty': 'Nada pendiente. Aquí llegan tus fallos.',
  'learn.review_entry.waiting.one': '{n} problema pendiente',
  'learn.review_entry.waiting.few': '{n} problemas pendientes',
  'learn.review_entry.waiting.many': '{n} problemas pendientes',
  'learn.review_entry.waiting.other': '{n} problemas pendientes',
  // Learn screen (canvas LearnHome / LearnBooks).
  'learn.title': 'Aprender',
  'learn.subtitle': 'Estudio tranquilo. Nada aquí afecta a tu nivel.',
  'learn.segment.courses': 'Cursos',
  'learn.segment.books': 'Libros',
  'learn.segments_a11y': 'Secciones de Aprender',
  'learn.continue': 'Continuar',
  'learn.course.chapter_line': 'Cap. {n} · {title} · {done} de {total}',
  'learn.course.exam_line': 'Examen final',
  'learn.course.continue_cycle': 'Continuar · ciclo {n}',
  'learn.course.start_cycle': 'Empezar ciclo {n}',
  'learn.suggest': 'Con nivel {rating} te sugerimos {course}.',
  'learn.course_a11y': '{title}, {range}, {status}',
  'learn.filter.all': 'Todos',
  'learn.filter.progress': 'En curso',
  'learn.filter.downloaded': 'Descargados',
  'learn.filter.finished': 'Terminados',
  'learn.empty_courses': 'Aún no hay cursos aquí.',
  'learn.load_failed': 'No se pudieron cargar los cursos.',

  // Course card status (LearnStates "Course card").
  'learn.status.remote': 'No descargado · {count}',
  'learn.status.downloading': 'Descargando…',
  'learn.status.fresh': 'En el teléfono · sin empezar',
  'learn.status.progress': '{done} de {total} · ciclo {n}',
  'learn.status.passed': 'Aprobado · examen {score}/{total}',
  'learn.status.cycle': 'Ciclo {n} · {done} de {total} · objetivo {s} s',
  'learn.status.cycle_free': 'Ciclo {n} · {done} de {total}',

  // Open-book transition: the first page.
  'learn.open.chapter': 'Capítulo',
};

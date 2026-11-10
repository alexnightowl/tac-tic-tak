// plan area, es: daily plan (weak-theme session: Home card, plan session, summary). Phone and desktop keys, all start with 'plan.'.
import type { Dict } from '../types';

export const planEs: Dict = {
  'plan.title': 'Plan de hoy',
  'plan.sub': 'Una sesión corta con tus temas más débiles',
  'plan.theme_new': 'tema nuevo',
  'plan.meta': '{min} min · dificultad {rating}',
  'plan.start': 'Empezar plan',
  'plan.start_a11y': 'Empezar el plan de hoy: {themes}',
  'plan.done_title': 'Plan hecho',
  'plan.done_result': '{solved} de {total} resueltos · {pct}%',
  'plan.again': 'Otra vez',
  'plan.again_a11y': 'Jugar otra vez el plan de hoy',
  'plan.by_theme': 'Temas del plan',
  'plan.theme_result': '{solved} de {total}',
  'plan.theme_none': 'sin problemas',
  'plan.summary_done': 'Plan de hoy hecho',
  'plan.summary_hint': 'Vuelve mañana para uno nuevo.',
  'plan.summary_early': 'Plan sin terminar',
  'plan.summary_early_hint': 'Cuenta cuando la sesión llega al final de su reloj.',
};

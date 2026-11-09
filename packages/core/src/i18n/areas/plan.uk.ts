// plan area, uk: daily plan (weak-theme session: Home card, plan session, summary). Phone and desktop keys, all start with 'plan.'.
import type { Dict } from '../types';

export const planUk: Dict = {
  'plan.title': 'План на сьогодні',
  'plan.sub': 'Коротка сесія на твої найслабші теми',
  'plan.theme_new': 'нова тема',
  'plan.meta': '{min} хв · складність {rating}',
  'plan.start': 'Почати план',
  'plan.start_a11y': 'Почати план на сьогодні: {themes}',
  'plan.done_title': 'План виконано',
  'plan.done_result': 'Розвʼязано {solved} з {total} · {pct}%',
  'plan.again': 'Ще раз',
  'plan.again_a11y': 'Пройти план на сьогодні ще раз',
  'plan.by_theme': 'Теми плану',
  'plan.theme_result': '{solved} з {total}',
  'plan.theme_none': 'без задач',
  'plan.summary_done': 'План на сьогодні виконано',
  'plan.summary_hint': 'Завтра буде новий.',
  'plan.summary_early': 'План не завершено',
  'plan.summary_early_hint': 'Зараховується сесія, пройдена до кінця часу.',
};

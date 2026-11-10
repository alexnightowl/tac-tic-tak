// plan area, ru: daily plan (weak-theme session: Home card, plan session, summary). Phone and desktop keys, all start with 'plan.'.
import type { Dict } from '../types';

export const planRu: Dict = {
  'plan.title': 'План на сегодня',
  'plan.sub': 'Короткая сессия по твоим самым слабым темам',
  'plan.theme_new': 'новая тема',
  'plan.meta': '{min} мин · сложность {rating}',
  'plan.start': 'Начать план',
  'plan.start_a11y': 'Начать план на сегодня: {themes}',
  'plan.done_title': 'План выполнен',
  'plan.done_result': 'Решено {solved} из {total} · {pct}%',
  'plan.again': 'Еще раз',
  'plan.again_a11y': 'Пройти план на сегодня еще раз',
  'plan.by_theme': 'Темы плана',
  'plan.theme_result': '{solved} из {total}',
  'plan.theme_none': 'без задач',
  'plan.summary_done': 'План на сегодня выполнен',
  'plan.summary_hint': 'Завтра будет новый.',
  'plan.summary_early': 'План не завершен',
  'plan.summary_early_hint': 'Засчитывается сессия, пройденная до конца времени.',
};

// haste area, uk: haste indicator (hasty mistakes: summary, session nudge, stats card). Phone and desktop keys, all start with 'haste.'.
import type { Dict } from '../types';

export const hasteUk: Dict = {
  'haste.secs': '{n} с',
  'haste.nudge': 'Не поспішай: ця помилка за {secs}',
  'haste.nudge_hint': 'Спершу перевір шахи, взяття й загрози.',
  'haste.summary_title': 'Поспішні помилки: {hasty} з {total}',
  'haste.summary_rule': 'Поспішна — це хибний хід швидше ніж за {secs} ({style}).',
  'haste.tip_many': 'Перед ходом переглянь усі шахи, взяття й загрози.',
  'haste.tip_some': 'Коли відповідь здається очевидною, дай собі ще секунду.',
  'haste.tip_none': 'Жодної через поспіх: ці помилки — з розрахунку.',
  'haste.title': 'Поспіх',
  'haste.share_caption': 'помилок за 30 днів — поспішні',
  'haste.share_of': '{hasty} з {mistakes} помилок',
  'haste.trend_down': 'Менше, ніж було: {prev}% за попередні 30 днів',
  'haste.trend_up': 'Більше, ніж було: {prev}% за попередні 30 днів',
  'haste.trend_same': 'Так само, як за попередні 30 днів',
  'haste.by_style': 'За стилями',
  'haste.style_row': '{hasty} з {mistakes}',
  'haste.weeks': 'Останні 8 тижнів',
  'haste.week_a11y': 'Тиждень з {date}: {pct}% поспішних ({hasty} з {mistakes})',
  'haste.rule': 'Поспішна — хибний хід швидше ніж за {bullet} у кулі, {blitz} у бліці, {rapid} у рапіді.',
  'haste.empty': 'За 30 днів жодної помилки — поки нічого міряти.',
  'haste.error': 'Не вдалося завантажити дані про поспіх.',
};

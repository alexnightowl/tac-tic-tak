// haste area, ru: haste indicator (hasty mistakes: summary, session nudge, stats card). Phone and desktop keys, all start with 'haste.'.
import type { Dict } from '../types';

export const hasteRu: Dict = {
  'haste.secs': '{n} с',
  'haste.nudge': 'Не спеши: эта ошибка за {secs}',
  'haste.nudge_hint': 'Сначала проверь шахи, взятия и угрозы.',
  'haste.summary_title': 'Поспешные ошибки: {hasty} из {total}',
  'haste.summary_rule': 'Поспешная — это неверный ход быстрее чем за {secs} ({style}).',
  'haste.tip_many': 'Перед ходом просмотри все шахи, взятия и угрозы.',
  'haste.tip_some': 'Когда ответ кажется очевидным, дай себе еще секунду.',
  'haste.tip_none': 'Ни одной из-за спешки: эти ошибки — от расчета.',
  'haste.title': 'Спешка',
  'haste.share_caption': 'ошибок за 30 дней — поспешные',
  'haste.share_of': '{hasty} из {mistakes} ошибок',
  'haste.trend_down': 'Меньше, чем было: {prev}% за предыдущие 30 дней',
  'haste.trend_up': 'Больше, чем было: {prev}% за предыдущие 30 дней',
  'haste.trend_same': 'Так же, как за предыдущие 30 дней',
  'haste.by_style': 'По стилям',
  'haste.style_row': '{hasty} из {mistakes}',
  'haste.weeks': 'Последние 8 недель',
  'haste.week_a11y': 'Неделя с {date}: {pct}% поспешных ({hasty} из {mistakes})',
  'haste.rule': 'Поспешная — неверный ход быстрее чем за {bullet} в пуле, {blitz} в блице, {rapid} в рапиде.',
  'haste.empty': 'За 30 дней ни одной ошибки — пока нечего измерять.',
  'haste.error': 'Не удалось загрузить данные о спешке.',
};

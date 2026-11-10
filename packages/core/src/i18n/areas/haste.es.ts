// haste area, es: haste indicator (hasty mistakes: summary, session nudge, stats card). Phone and desktop keys, all start with 'haste.'.
import type { Dict } from '../types';

export const hasteEs: Dict = {
  'haste.secs': '{n} s',
  'haste.nudge': 'Más despacio: ese error fue en {secs}',
  'haste.nudge_hint': 'Revisa primero jaques, capturas y amenazas.',
  'haste.summary_title': 'Errores por prisa: {hasty} de {total}',
  'haste.summary_rule': 'Por prisa significa una jugada errónea en menos de {secs} ({style}).',
  'haste.tip_many': 'Antes de jugar, mira cada jaque, captura y amenaza.',
  'haste.tip_some': 'Cuando la respuesta parezca obvia, date un segundo más.',
  'haste.tip_none': 'Ninguno fue por prisa: estos errores vinieron del cálculo.',
  'haste.title': 'Prisa',
  'haste.share_caption': 'de los errores fueron por prisa en 30 días',
  'haste.share_of': '{hasty} de {mistakes} errores',
  'haste.trend_down': 'Menos que el {prev}% de los 30 días anteriores',
  'haste.trend_up': 'Más que el {prev}% de los 30 días anteriores',
  'haste.trend_same': 'Igual que en los 30 días anteriores',
  'haste.by_style': 'Por ritmo',
  'haste.style_row': '{hasty} de {mistakes}',
  'haste.weeks': 'Últimas 8 semanas',
  'haste.week_a11y': 'Semana del {date}: {pct}% por prisa ({hasty} de {mistakes})',
  'haste.rule': 'Por prisa: una jugada errónea en menos de {bullet} en bala, {blitz} en blitz, {rapid} en rápida.',
  'haste.empty': 'Sin errores en los últimos 30 días, así que aún no hay nada que medir.',
  'haste.error': 'No se pudieron cargar los datos de prisa.',
};

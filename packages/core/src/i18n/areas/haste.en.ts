// haste area, en: haste indicator (hasty mistakes: summary, session nudge, stats card). Phone and desktop keys, all start with 'haste.'.
import type { Dict } from '../types';

export const hasteEn: Dict = {
  'haste.secs': '{n} s',
  'haste.nudge': 'Slow down: that mistake took {secs}',
  'haste.nudge_hint': 'Check checks, captures and threats first.',
  'haste.summary_title': 'Hasty mistakes: {hasty} of {total}',
  'haste.summary_rule': 'Hasty means a wrong move in under {secs} ({style}).',
  'haste.tip_many': 'Before you move, look at every check, capture and threat.',
  'haste.tip_some': 'When the answer looks obvious, give it one more second.',
  'haste.tip_none': 'None were rushed: these mistakes came from calculation.',
  'haste.title': 'Haste',
  'haste.share_caption': 'of mistakes were hasty in 30 days',
  'haste.share_of': '{hasty} of {mistakes} mistakes',
  'haste.trend_down': 'Down from {prev}% the 30 days before',
  'haste.trend_up': 'Up from {prev}% the 30 days before',
  'haste.trend_same': 'Same as the 30 days before',
  'haste.by_style': 'By style',
  'haste.style_row': '{hasty} of {mistakes}',
  'haste.weeks': 'Last 8 weeks',
  'haste.week_a11y': 'Week of {date}: {pct}% hasty ({hasty} of {mistakes})',
  'haste.rule': 'Hasty: a wrong move faster than {bullet} in bullet, {blitz} in blitz, {rapid} in rapid.',
  'haste.empty': 'No mistakes in the last 30 days, so nothing to measure yet.',
  'haste.error': 'Couldn’t load the haste stats.',
};

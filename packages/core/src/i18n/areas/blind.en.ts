// blind area, en: blind mode (pieces hide after a look; play setup toggle, runner, summary). Phone and desktop keys, all start with 'blind.'.
import type { Dict } from '../types';

export const blindEn: Dict = {
  // Play setup (Free / Themes)
  'blind.title': 'Blind',
  'blind.setup.desc': 'The pieces vanish after a look. Play the line from memory.',
  'blind.setup.toggle_a11y': 'Blind mode',
  'blind.setup.preview': 'Look time',
  'blind.setup.sec': '{n} s',
  'blind.setup.sec_a11y': '{n} seconds to look',
  'blind.setup.hint': 'Blind is harder: start 200–300 below your level.',
  'blind.setup.sum_value': '{n} s look',

  // Runner
  'blind.runner.memorize': 'Memorize · {n}',
  'blind.runner.memorize_a11y': 'Memorize the position, {n} seconds left',
  'blind.runner.from_memory': 'Play from memory',
  'blind.runner.reply': 'Opponent: {san}',
  'blind.runner.solved': 'Solved blind',
  'blind.runner.missed': 'Here is the position',
  'blind.runner.peek': 'Peek',
  'blind.runner.peek_a11y': 'Show the pieces for a moment',
  'blind.runner.peeks.one': '{n} peek',
  'blind.runner.peeks.few': '{n} peeks',
  'blind.runner.peeks.many': '{n} peeks',
  'blind.runner.peeks.other': '{n} peeks',
  'blind.runner.no_peeks': 'No peeks',

  // Summary
  'blind.summary.peeks.one': 'Blind · peeked {n} time',
  'blind.summary.peeks.few': 'Blind · peeked {n} times',
  'blind.summary.peeks.many': 'Blind · peeked {n} times',
  'blind.summary.peeks.other': 'Blind · peeked {n} times',
  'blind.summary.no_peeks': 'Blind · no peeks',
  'blind.summary.look': '{n} s look per puzzle',

  // Desktop hotkeys
  'blind.key.peek': 'Peek (blind)',
  'blind.key.peek_short': 'peek',

  // Piece letters for the opponent's move in text (SAN)
  'blind.piece.K': 'K',
  'blind.piece.Q': 'Q',
  'blind.piece.R': 'R',
  'blind.piece.B': 'B',
  'blind.piece.N': 'N',
};

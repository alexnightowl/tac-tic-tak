// blind area, es: blind mode (pieces hide after a look; play setup toggle, runner, summary). Phone and desktop keys, all start with 'blind.'.
import type { Dict } from '../types';

export const blindEs: Dict = {
  // Play setup (Free / Themes)
  'blind.title': 'A ciegas',
  'blind.setup.desc': 'Las piezas desaparecen tras un vistazo. Juega la línea de memoria.',
  'blind.setup.toggle_a11y': 'Modo a ciegas',
  'blind.setup.preview': 'Tiempo de vista',
  'blind.setup.sec': '{n} s',
  'blind.setup.sec_a11y': '{n} segundos para mirar',
  'blind.setup.hint': 'A ciegas es más difícil: empieza 200–300 por debajo de tu nivel.',
  'blind.setup.sum_value': '{n} s de vista',

  // Runner
  'blind.runner.memorize': 'Memoriza · {n}',
  'blind.runner.memorize_a11y': 'Memoriza la posición, quedan {n} segundos',
  'blind.runner.from_memory': 'Juega de memoria',
  'blind.runner.reply': 'Rival: {san}',
  'blind.runner.solved': 'Resuelto a ciegas',
  'blind.runner.missed': 'Esta es la posición',
  'blind.runner.peek': 'Vistazo',
  'blind.runner.peek_a11y': 'Mostrar las piezas un momento',
  'blind.runner.peeks.one': '{n} vistazo',
  'blind.runner.peeks.few': '{n} vistazos',
  'blind.runner.peeks.many': '{n} vistazos',
  'blind.runner.peeks.other': '{n} vistazos',
  'blind.runner.no_peeks': 'Sin vistazos',

  // Summary
  'blind.summary.peeks.one': 'A ciegas · {n} vistazo',
  'blind.summary.peeks.few': 'A ciegas · {n} vistazos',
  'blind.summary.peeks.many': 'A ciegas · {n} vistazos',
  'blind.summary.peeks.other': 'A ciegas · {n} vistazos',
  'blind.summary.no_peeks': 'A ciegas · sin vistazos',
  'blind.summary.look': '{n} s de vista por problema',

  // Desktop hotkeys
  'blind.key.peek': 'Echar un vistazo (a ciegas)',
  'blind.key.peek_short': 'vistazo',

  // Piece letters for the opponent's move in text (SAN)
  'blind.piece.K': 'R',
  'blind.piece.Q': 'D',
  'blind.piece.R': 'T',
  'blind.piece.B': 'A',
  'blind.piece.N': 'C',
};

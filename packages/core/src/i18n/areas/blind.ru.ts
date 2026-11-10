// blind area, ru: blind mode (pieces hide after a look; play setup toggle, runner, summary). Phone and desktop keys, all start with 'blind.'.
import type { Dict } from '../types';

export const blindRu: Dict = {
  // Play setup (Free / Themes)
  'blind.title': 'Вслепую',
  'blind.setup.desc': 'Фигуры исчезают после показа. Решай по памяти.',
  'blind.setup.toggle_a11y': 'Игра вслепую',
  'blind.setup.preview': 'Время показа',
  'blind.setup.sec': '{n} с',
  'blind.setup.sec_a11y': '{n} секунд на показ',
  'blind.setup.hint': 'Вслепую сложнее: начни на 200–300 ниже своего уровня.',
  'blind.setup.sum_value': 'показ {n} с',

  // Runner
  'blind.runner.memorize': 'Запомни · {n}',
  'blind.runner.memorize_a11y': 'Запомни позицию, осталось {n} с',
  'blind.runner.from_memory': 'Играй по памяти',
  'blind.runner.reply': 'Соперник: {san}',
  'blind.runner.solved': 'Решено вслепую',
  'blind.runner.missed': 'Вот как стоят фигуры',
  'blind.runner.peek': 'Подсмотреть',
  'blind.runner.peek_a11y': 'Показать фигуры на миг',
  'blind.runner.peeks.one': '{n} подглядывание',
  'blind.runner.peeks.few': '{n} подглядывания',
  'blind.runner.peeks.many': '{n} подглядываний',
  'blind.runner.peeks.other': '{n} подглядывания',
  'blind.runner.no_peeks': 'Без подглядываний',

  // Summary
  'blind.summary.peeks.one': 'Вслепую · подсмотрено {n} раз',
  'blind.summary.peeks.few': 'Вслепую · подсмотрено {n} раза',
  'blind.summary.peeks.many': 'Вслепую · подсмотрено {n} раз',
  'blind.summary.peeks.other': 'Вслепую · подсмотрено {n} раза',
  'blind.summary.no_peeks': 'Вслепую · без подглядываний',
  'blind.summary.look': 'показ {n} с на задачу',

  // Desktop hotkeys
  'blind.key.peek': 'Подсмотреть (вслепую)',
  'blind.key.peek_short': 'подсмотреть',

  // Piece letters for the opponent's move in text (SAN)
  'blind.piece.K': 'Кр',
  'blind.piece.Q': 'Ф',
  'blind.piece.R': 'Л',
  'blind.piece.B': 'С',
  'blind.piece.N': 'К',
};

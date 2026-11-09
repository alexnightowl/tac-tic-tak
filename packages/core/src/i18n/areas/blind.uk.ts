// blind area, uk: blind mode (pieces hide after a look; play setup toggle, runner, summary). Phone and desktop keys, all start with 'blind.'.
import type { Dict } from '../types';

export const blindUk: Dict = {
  // Play setup (Free / Themes)
  'blind.title': 'Наосліп',
  'blind.setup.desc': 'Фігури зникають після показу. Розвʼязуй по памʼяті.',
  'blind.setup.toggle_a11y': 'Гра наосліп',
  'blind.setup.preview': 'Час на показ',
  'blind.setup.sec': '{n} с',
  'blind.setup.sec_a11y': '{n} секунд на показ',
  'blind.setup.hint': 'Наосліп складніше: почни на 200–300 нижче свого рівня.',
  'blind.setup.sum_value': 'показ {n} с',

  // Runner
  'blind.runner.memorize': 'Запамʼятай · {n}',
  'blind.runner.memorize_a11y': 'Запамʼятай позицію, лишилось {n} с',
  'blind.runner.from_memory': 'Грай по памʼяті',
  'blind.runner.reply': 'Суперник: {san}',
  'blind.runner.solved': 'Розвʼязано наосліп',
  'blind.runner.missed': 'Ось як стоять фігури',
  'blind.runner.peek': 'Підглянути',
  'blind.runner.peek_a11y': 'Показати фігури на мить',
  'blind.runner.peeks.one': '{n} підглядання',
  'blind.runner.peeks.few': '{n} підглядання',
  'blind.runner.peeks.many': '{n} підглядань',
  'blind.runner.peeks.other': '{n} підглядання',
  'blind.runner.no_peeks': 'Без підглядань',

  // Summary
  'blind.summary.peeks.one': 'Наосліп · підглянуто {n} раз',
  'blind.summary.peeks.few': 'Наосліп · підглянуто {n} рази',
  'blind.summary.peeks.many': 'Наосліп · підглянуто {n} разів',
  'blind.summary.peeks.other': 'Наосліп · підглянуто {n} раза',
  'blind.summary.no_peeks': 'Наосліп · без підглядань',
  'blind.summary.look': 'показ {n} с на задачу',

  // Desktop hotkeys
  'blind.key.peek': 'Підглянути (наосліп)',
  'blind.key.peek_short': 'підглянути',

  // Piece letters for the opponent's move in text (SAN)
  'blind.piece.K': 'Кр',
  'blind.piece.Q': 'Ф',
  'blind.piece.R': 'Т',
  'blind.piece.B': 'С',
  'blind.piece.N': 'К',
};

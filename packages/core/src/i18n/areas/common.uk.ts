// common area, uk. Keys from the web dict (apps/frontend/src/lib/i18n.ts) keep
// their web text verbatim; mobile-only keys follow. Edit only your area's files.
import type { Dict } from '../types';

export const commonUk: Dict = {
  'home': 'Головна',
  'play': 'Гра',
  'review': 'Рев’ю',
  'stats': 'Статс',
  'settings': 'Налашт.',
  'leaderboard': 'Топ',
  'logout': 'Вийти',
  'nav.friends': 'Друзі',

  'brand.tagline': 'Адаптивний тренажер шахових тактик',

  'common.save': 'Зберегти',
  'common.cancel': 'Скасувати',

  'style.bullet.name': 'Пуля',
  'style.bullet.desc': 'Швидке розпізнавання патернів. Короткі сесії, миттєві рішення — тренування для пулі та гіпер-пулі.',
  'style.bullet.rating_label': 'Рейтинг пулі',
  'style.blitz.name': 'Бліц',
  'style.blitz.desc': 'Універсальний стиль. Збалансований темп і складність — основа для тренування тактики під бліц.',
  'style.blitz.rating_label': 'Рейтинг бліцу',
  'style.rapid.name': 'Рапід',
  'style.rapid.desc': 'Глибокі розрахунки. Довші сесії, складніші позиції, вища точність — для рапіду та класики.',
  'style.rapid.rating_label': 'Рейтинг рапіду',

  'levels.novice': 'Новачок',
  'levels.beginner': 'Початківець',
  'levels.intermediate': 'Середній',
  'levels.advanced': 'Просунутий',
  'levels.expert': 'Експерт',

  // Phase 2 mobile-only copy (was in local strings.ts tables).
  'ui.password_show': 'Показати пароль',
  'ui.password_hide': 'Сховати пароль',
  'ui.loading': 'Завантаження',
  'ui.on': 'Увімк.',
  'ui.off': 'Вимк.',
  'nav.social': 'Спільнота',
  'nav.rivals': 'Суперники',
  'brand.name': 'tac·tic·tak',
  'dev.open': 'Меню розробника',
};

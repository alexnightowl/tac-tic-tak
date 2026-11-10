// common area, ru. Translated from en (uk as a second reference); same keys and
// order as common.en.ts. Edit only your area's files.
import type { Dict } from '../types';

export const commonRu: Dict = {
  'home': 'Главная',
  'play': 'Игра',
  'review': 'Повторение',
  'stats': 'Статистика',
  'settings': 'Настройки',
  'leaderboard': 'Топ',
  'logout': 'Выйти',
  'nav.friends': 'Друзья',

  'brand.tagline': 'Адаптивный тренажер шахматной тактики',

  'common.save': 'Сохранить',
  'common.cancel': 'Отмена',

  'style.bullet.name': 'Пуля',
  'style.bullet.desc': 'Быстрое распознавание паттернов. Короткие сессии, мгновенные решения — тренирует скорость для пули и гиперпули.',
  'style.bullet.rating_label': 'Уровень в пуле',
  'style.blitz.name': 'Блиц',
  'style.blitz.desc': 'Универсальный стиль. Сбалансированный темп и сложность — основной выбор для тренировки тактики под блиц.',
  'style.blitz.rating_label': 'Уровень в блице',
  'style.rapid.name': 'Рапид',
  'style.rapid.desc': 'Глубокий расчет. Более длинные сессии, сложные позиции, высокая планка точности — для рапида и классики.',
  'style.rapid.rating_label': 'Уровень в рапиде',

  'levels.novice': 'Новичок',
  'levels.beginner': 'Начинающий',
  'levels.intermediate': 'Средний',
  'levels.advanced': 'Продвинутый',
  'levels.expert': 'Эксперт',

  // Phase 2 mobile-only copy (was in local strings.ts tables).
  'ui.password_show': 'Показать пароль',
  'ui.password_hide': 'Скрыть пароль',
  'ui.loading': 'Загрузка',
  'ui.on': 'Вкл.',
  'ui.off': 'Выкл.',
  'nav.social': 'Сообщество',
  'nav.rivals': 'Соперники',
  'nav.league': 'Лига',
  'brand.name': 'tac·tic·tak',
  'dev.open': 'Меню разработчика',
  // Board a11y (VoiceOver / screen readers): squares, pieces, promotion.
  'board.label': 'Шахматная доска',
  'board.white': 'белый',
  'board.black': 'черный',
  'board.piece.p': 'пешка',
  'board.piece.n': 'конь',
  'board.piece.b': 'слон',
  'board.piece.r': 'ладья',
  'board.piece.q': 'ферзь',
  'board.piece.k': 'король',
  'board.promotion': 'Превратить в',
  'board.promotion_cancel': 'Отменить превращение',
};

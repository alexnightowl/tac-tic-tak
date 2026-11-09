// dxauth area, uk: desktop web screens (canvas page "Desktop — redesign", DX*
// artboards). Keys start with 'dx.auth.'; reuse existing keys first.
import type { Dict } from '../types';

export const dxauthUk: Dict = {
  // Login / register hero panel (DXLogin, DXRegister).
  'dx.auth.eyebrow': 'Тактичний тренажер',
  'dx.auth.headline': 'Бач комбінацію\nраніше за суперника.',
  'dx.auth.lede': 'Короткі сесії на твоєму рівні. Рейтинг росте, коли ти бачиш комбінації швидше за суперника.',
  // Stat captions; the numbers come from the app's own catalogues.
  'dx.auth.stat_themes.one': 'тактична тема',
  'dx.auth.stat_themes.few': 'тактичні теми',
  'dx.auth.stat_themes.many': 'тактичних тем',
  'dx.auth.stat_themes.other': 'тактичних тем',
  'dx.auth.stat_styles.one': 'стиль тренування',
  'dx.auth.stat_styles.few': 'стилі тренування',
  'dx.auth.stat_styles.many': 'стилів тренування',
  'dx.auth.stat_styles.other': 'стилів тренування',
  'dx.auth.stat_minutes': '{n} хв',
  'dx.auth.stat_shortest': 'найкоротша сесія',
  'dx.auth.footer': 'Задачі з бази Lichess (CC0) · v{version}',

  // Forms.
  'dx.auth.login_title': 'З поверненням',
  'dx.auth.login_sub': 'Увійди, щоб продовжити серію.',
  'dx.auth.login_enter': 'Enter — увійти',
  'dx.auth.register_title': 'Створи акаунт',
  'dx.auth.register_sub': 'Нікнейм і пароль — більше нічого.',
  'dx.auth.repeat_placeholder': 'Ще раз пароль',
  'dx.auth.register_enter': 'Enter — створити акаунт',

  // Onboarding (DXOnb1–4).
  'dx.auth.onb.next_hint': 'далі',
  'dx.auth.onb.task': 'Білі ходять · мат у 1',
  'dx.auth.onb.try': 'Спробуй',
  'dx.auth.onb.solved': 'Розвʼязано за {s} с',
  'dx.auth.onb.wrong': 'Не той хід',
  'dx.auth.onb.again': 'Ще раз',
  'dx.auth.onb.habit': 'Щоденна звичка',
  'dx.auth.onb.streak_value': '4 дні',
  'dx.auth.onb.streak_caption': 'поточна серія',
  'dx.auth.onb.weekdays': 'Пн,Вт,Ср,Чт,Пт,Сб,Нд',
};

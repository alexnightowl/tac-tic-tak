// dxauth area, ru: desktop web screens (canvas page "Desktop — redesign", DX*
// artboards). Keys start with 'dx.auth.'; reuse existing keys first.
import type { Dict } from '../types';

export const dxauthRu: Dict = {
  // Login / register hero panel (DXLogin, DXRegister).
  'dx.auth.eyebrow': 'Тактический тренажер',
  'dx.auth.headline': 'Видь комбинацию\nраньше соперника.',
  'dx.auth.lede': 'Короткие сессии на твоем уровне. Уровень растет, когда ты видишь комбинации быстрее соперника.',
  // Stat captions; the numbers come from the app's own catalogues.
  'dx.auth.stat_themes.one': 'тактическая тема',
  'dx.auth.stat_themes.few': 'тактические темы',
  'dx.auth.stat_themes.many': 'тактических тем',
  'dx.auth.stat_themes.other': 'тактической темы',
  'dx.auth.stat_styles.one': 'стиль тренировки',
  'dx.auth.stat_styles.few': 'стиля тренировки',
  'dx.auth.stat_styles.many': 'стилей тренировки',
  'dx.auth.stat_styles.other': 'стиля тренировки',
  'dx.auth.stat_minutes': '{n} мин',
  'dx.auth.stat_shortest': 'самая короткая сессия',
  'dx.auth.footer': 'Задачи из базы Lichess (CC0) · v{version}',

  // Forms.
  'dx.auth.login_title': 'С возвращением',
  'dx.auth.login_sub': 'Войди, чтобы продолжить серию.',
  'dx.auth.login_enter': 'Enter — войти',
  'dx.auth.register_title': 'Создай аккаунт',
  'dx.auth.register_sub': 'Никнейм и пароль — больше ничего.',
  'dx.auth.repeat_placeholder': 'Пароль еще раз',
  'dx.auth.register_enter': 'Enter — создать аккаунт',

  // Onboarding (DXOnb1–4).
  'dx.auth.onb.next_hint': 'далее',
  'dx.auth.onb.task': 'Ход белых · мат в 1 ход',
  'dx.auth.onb.try': 'Попробуй',
  'dx.auth.onb.solved': 'Решено за {s} с',
  'dx.auth.onb.wrong': 'Не тот ход',
  'dx.auth.onb.again': 'Еще раз',
  'dx.auth.onb.habit': 'Ежедневная привычка',
  'dx.auth.onb.streak_value': '4 дня',
  'dx.auth.onb.streak_caption': 'текущая серия',
  'dx.auth.onb.weekdays': 'Пн,Вт,Ср,Чт,Пт,Сб,Вс',
};

// shell area, ru: tab bar, header avatar menu, toasts, offline,
// error and not-found copy (Phase 4 shell stream). Mobile-only keys.
import type { Dict } from '../types';

export const shellRu: Dict = {
  // Avatar menu (header avatar → sheet).
  'shell.menu.open': 'Открыть меню аккаунта',
  'shell.menu.title': 'Аккаунт',
  'shell.menu.profile': 'Мой профиль',
  'shell.menu.close': 'Закрыть',
  'shell.menu.admin': 'Админка',
  // Web: Share falls back to the clipboard where the browser has no share sheet.
  'shell.copied': 'Скопировано в буфер обмена',

  // Tab bar.
  'shell.tabs': 'Основные разделы',


  // Toasts (the web hard-coded these in English).
  'shell.toast.achievement': 'Достижение',
  'shell.toast.notice': 'Уведомление',
  'shell.toast.dismiss': 'Закрыть',

  // Offline banner, error boundary, not-found.
  'shell.offline': 'Нет соединения — показываем сохраненные данные',
  'shell.error.title': 'Что-то сломалось',
  'shell.error.body': 'На этом экране произошла ошибка. Твой прогресс в безопасности — попробуй еще раз.',
  'shell.error.retry': 'Попробовать еще раз',
  'shell.not_found.title': 'Здесь ничего нет',
  'shell.not_found.body': 'Эта ссылка никуда не ведет в приложении.',
  'shell.go_home': 'На главную',
  'shell.back': 'Назад',

  // Language switch labels (also used by the settings stream).
  'shell.lang.en': 'EN',
  'shell.lang.uk': 'УКР',
  'shell.lang.ru': 'РУС',
  'shell.lang.es': 'ES',
};

// shell area, uk: tab bar, header avatar menu, toasts, offline,
// error and not-found copy (Phase 4 shell stream). Mobile-only keys.
import type { Dict } from '../types';

export const shellUk: Dict = {
  // Avatar menu (header avatar → sheet).
  'shell.menu.open': 'Відкрити меню акаунта',
  'shell.menu.title': 'Акаунт',
  'shell.menu.profile': 'Мій профіль',
  'shell.menu.close': 'Закрити',

  // Tab bar.
  'shell.tabs': 'Основні розділи',


  // Toasts (the web hard-coded these in English).
  'shell.toast.achievement': 'Досягнення',
  'shell.toast.notice': 'Повідомлення',
  'shell.toast.dismiss': 'Закрити',

  // Offline banner, error boundary, not-found.
  'shell.offline': 'Немає з’єднання — показуємо збережені дані',
  'shell.error.title': 'Щось зламалося',
  'shell.error.body': 'На цьому екрані сталася помилка. Ваш прогрес у безпеці — спробуйте ще раз.',
  'shell.error.retry': 'Спробувати ще раз',
  'shell.not_found.title': 'Тут нічого немає',
  'shell.not_found.body': 'Це посилання нікуди не веде в застосунку.',
  'shell.go_home': 'На головну',
  'shell.back': 'Назад',

  // Language switch labels (also used by the settings stream).
  'shell.lang.en': 'EN',
  'shell.lang.uk': 'УКР',
};

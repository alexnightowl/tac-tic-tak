// shell area, en: tab bar, header avatar menu, toasts, offline,
// error and not-found copy (Phase 4 shell stream). Mobile-only keys.
import type { Dict } from '../types';

export const shellEn: Dict = {
  // Avatar menu (header avatar → sheet).
  'shell.menu.open': 'Open account menu',
  'shell.menu.title': 'Account',
  'shell.menu.profile': 'My profile',
  'shell.menu.close': 'Close',

  // Tab bar.
  'shell.tabs': 'Main sections',


  // Toasts (the web hard-coded these in English).
  'shell.toast.achievement': 'Achievement',
  'shell.toast.notice': 'Notice',
  'shell.toast.dismiss': 'Dismiss',

  // Offline banner, error boundary, not-found.
  'shell.offline': 'You’re offline — showing saved data',
  'shell.error.title': 'Something broke',
  'shell.error.body': 'This screen hit an error. Your progress is safe — try again.',
  'shell.error.retry': 'Try again',
  'shell.not_found.title': 'Nothing here',
  'shell.not_found.body': 'This link doesn’t lead anywhere in the app.',
  'shell.go_home': 'Go home',
  'shell.back': 'Back',

  // Language switch labels (also used by the settings stream).
  'shell.lang.en': 'EN',
  'shell.lang.uk': 'УКР',
};

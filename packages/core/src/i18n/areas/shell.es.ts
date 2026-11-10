// shell area, es: tab bar, header avatar menu, toasts, offline,
// error and not-found copy (Phase 4 shell stream). Mobile-only keys.
import type { Dict } from '../types';

export const shellEs: Dict = {
  // Avatar menu (header avatar → sheet).
  'shell.menu.open': 'Abrir menú de la cuenta',
  'shell.menu.title': 'Cuenta',
  'shell.menu.profile': 'Mi perfil',
  'shell.menu.close': 'Cerrar',
  'shell.menu.admin': 'Admin',
  // Web: Share falls back to the clipboard where the browser has no share sheet.
  'shell.copied': 'Copiado al portapapeles',

  // Tab bar.
  'shell.tabs': 'Secciones principales',


  // Toasts (the web hard-coded these in English).
  'shell.toast.achievement': 'Logro',
  'shell.toast.notice': 'Aviso',
  'shell.toast.dismiss': 'Cerrar',

  // Offline banner, error boundary, not-found.
  'shell.offline': 'Estás sin conexión: se muestran datos guardados',
  'shell.error.title': 'Algo falló',
  'shell.error.body': 'Esta pantalla tuvo un error. Tu progreso está a salvo: inténtalo de nuevo.',
  'shell.error.retry': 'Reintentar',
  'shell.not_found.title': 'Aquí no hay nada',
  'shell.not_found.body': 'Este enlace no lleva a ninguna parte de la app.',
  'shell.go_home': 'Ir al inicio',
  'shell.back': 'Atrás',

  // Language switch labels (also used by the settings stream).
  'shell.lang.en': 'EN',
  'shell.lang.uk': 'УКР',
  'shell.lang.ru': 'РУС',
  'shell.lang.es': 'ES',
};

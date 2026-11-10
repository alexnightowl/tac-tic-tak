// dxauth area, es: desktop web screens (canvas page "Desktop — redesign", DX*
// artboards). Keys start with 'dx.auth.'; reuse existing keys first.
import type { Dict } from '../types';

export const dxauthEs: Dict = {
  // Login / register hero panel (DXLogin, DXRegister).
  'dx.auth.eyebrow': 'Entrenador de táctica',
  'dx.auth.headline': 'Ve el golpe\nantes que tu rival.',
  'dx.auth.lede': 'Sesiones cortas a tu nivel. Tu nivel sube a medida que ves las combinaciones más rápido que tu rival.',
  // Stat captions; the numbers come from the app's own catalogues.
  'dx.auth.stat_themes.one': 'tema táctico',
  'dx.auth.stat_themes.other': 'temas tácticos',
  'dx.auth.stat_themes.few': 'temas tácticos',
  'dx.auth.stat_themes.many': 'temas tácticos',
  'dx.auth.stat_styles.one': 'estilo de entrenamiento',
  'dx.auth.stat_styles.other': 'estilos de entrenamiento',
  'dx.auth.stat_styles.few': 'estilos de entrenamiento',
  'dx.auth.stat_styles.many': 'estilos de entrenamiento',
  'dx.auth.stat_minutes': '{n} min',
  'dx.auth.stat_shortest': 'la sesión más corta',
  'dx.auth.footer': 'Problemas de la base de datos de Lichess (CC0) · v{version}',

  // Forms.
  'dx.auth.login_title': 'Hola de nuevo',
  'dx.auth.login_sub': 'Entra para mantener tu racha.',
  'dx.auth.login_enter': 'Enter — entrar',
  'dx.auth.register_title': 'Crea una cuenta',
  'dx.auth.register_sub': 'Un apodo y una contraseña, nada más.',
  'dx.auth.repeat_placeholder': 'La contraseña otra vez',
  'dx.auth.register_enter': 'Enter — crear la cuenta',

  // Onboarding (DXOnb1–4).
  'dx.auth.onb.next_hint': 'siguiente',
  'dx.auth.onb.task': 'Juegan las blancas · mate en 1',
  'dx.auth.onb.try': 'Pruébalo',
  'dx.auth.onb.solved': 'Resuelto en {s} s',
  'dx.auth.onb.wrong': 'Esa no es',
  'dx.auth.onb.again': 'Otra vez',
  'dx.auth.onb.habit': 'Hábito diario',
  'dx.auth.onb.streak_value': '4 días',
  'dx.auth.onb.streak_caption': 'racha actual',
  'dx.auth.onb.weekdays': 'Lu,Ma,Mi,Ju,Vi,Sá,Do',
};

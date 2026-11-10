// onboarding area, es. The 4-step welcome (design v2 MobOnboarding1–4);
// the web's 5-slide copy was retired with it. Edit only your area's files.
import type { Dict } from '../types';

export const onboardingEs: Dict = {
  'onboarding.skip': 'Omitir',
  'onboarding.step': 'Paso {n} de {total}',
  'onboarding.begin': 'Empezar',
  'onboarding.continue': 'Continuar',
  'onboarding.find_level': 'Encontrar mi nivel',
  'onboarding.skip_start': 'Omitir — empezar en {rating}',
  // Replayed by a player who already has a level (calibration done).
  'onboarding.recalibrate': 'Recalibrar mi nivel',
  'onboarding.keep_level': 'Mantener mi nivel',
  'onboarding.recalibrate_note': 'En las próximas 5 sesiones de cada estilo la dificultad cambia más rápido para volver a encontrar tu nivel. Tu nivel y tu historial se conservan.',
  'onboarding.recalibrate_error': 'No se pudo conectar con el servidor. Inténtalo de nuevo.',

  // 1 · Welcome (kicker = brand.name).
  'onboarding.welcome.title': 'Ve el golpe\nantes de que llegue',
  'onboarding.welcome.body': 'Sesiones tácticas cortas en torno a una idea: encuentra la jugada ganadora.',

  // 2 · The training (animated back-rank mate).
  'onboarding.training.kicker': 'El entrenamiento',
  'onboarding.training.title': 'Una jugada gana.\nEncuéntrala.',
  'onboarding.training.body': 'Cada sesión es una serie de problemas a tu nivel. Resuelve rápido y sin errores: tu nivel te seguirá.',
  'onboarding.training.board': 'Mate del pasillo: torre de d1 a d8',
  'onboarding.training.pill': 'Rd8# · resuelto en 4 s',

  // 3 · Your path (the rank eyes).
  'onboarding.path.kicker': 'Tu camino',
  'onboarding.path.title': 'Cada nivel\ndespierta un nuevo ojo',
  'onboarding.path.body': 'Sube de Novato a Experto. Tu rango sigue a tu nivel, y puede bajar si dejas de entrenar.',
  'onboarding.path.you': '{level} · tú',

  // 4 · The habit (sample streak card; illustrative values).
  'onboarding.habit.kicker': 'El hábito',
  'onboarding.habit.title': 'Unos minutos al día',
  'onboarding.habit.body': 'Mantén viva la llama: un protector por semana cubre un día perdido.',
  'onboarding.habit.days': '4',
  'onboarding.habit.unit': 'días de racha',
  'onboarding.habit.best': 'Récord: 12 días',
  'onboarding.habit.weekdays': 'L,M,X,J,V,S,D',
  'onboarding.habit.freeze_note': 'El miércoles lo cubrió tu protector semanal',
  'onboarding.habit.review_title': 'Los problemas fallados vuelven',
  'onboarding.habit.review_body': 'Entrénalos en Repaso hasta que se queden',
  'onboarding.habit.review_count': '3',
};

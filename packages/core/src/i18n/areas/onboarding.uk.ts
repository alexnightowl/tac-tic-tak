// onboarding area, uk. The 4-step welcome (design v2 MobOnboarding1–4);
// the web's 5-slide copy was retired with it. Edit only your area's files.
import type { Dict } from '../types';

export const onboardingUk: Dict = {
  'onboarding.skip': 'Пропустити',
  'onboarding.step': 'Крок {n} з {total}',
  'onboarding.begin': 'Почати',
  'onboarding.continue': 'Далі',
  'onboarding.find_level': 'Визначити мій рівень',
  'onboarding.skip_start': 'Пропустити — почати з {rating}',
  // Replayed by a player who already has a level (calibration done).
  'onboarding.recalibrate': 'Перекалібрувати рівень',
  'onboarding.keep_level': 'Залишити мій рівень',
  'onboarding.recalibrate_note': 'Наступні 5 сесій у кожному стилі заново визначать твій рівень. Рейтинг та історія залишаться.',
  'onboarding.recalibrate_error': 'Не вдалося зв’язатися із сервером. Спробуй ще раз.',

  // 1 · Welcome (kicker = brand.name).
  'onboarding.welcome.title': 'Побач удар,\nперш ніж він влучить',
  'onboarding.welcome.body': 'Короткі тактичні сесії навколо однієї ідеї — знайди хід, що виграє.',

  // 2 · The training (animated back-rank mate).
  'onboarding.training.kicker': 'Тренування',
  'onboarding.training.title': 'Один хід виграє.\nЗнайди його.',
  'onboarding.training.body': 'Кожна сесія — серія задач під твій рівень. Розвʼязуй швидко й чисто — рейтинг піде слідом.',
  'onboarding.training.board': 'Мат по останній горизонталі: тура d1–d8',
  'onboarding.training.pill': 'Rd8# · розвʼязано за 4 с',

  // 3 · Your path (the rank eyes).
  'onboarding.path.kicker': 'Твій шлях',
  'onboarding.path.title': 'Кожен рівень\nпробуджує нове око',
  'onboarding.path.body': 'Піднімайся від Новачка до Експерта. Ранг іде за рейтингом — і може впасти, якщо перестанеш тренуватися.',
  'onboarding.path.you': '{level} · ти',

  // 4 · The habit (sample streak card; illustrative values).
  'onboarding.habit.kicker': 'Звичка',
  'onboarding.habit.title': 'Кілька хвилин на день',
  'onboarding.habit.body': 'Підтримуй вогонь — одна заморозка на тиждень прикриває пропущений день.',
  'onboarding.habit.days': '4',
  'onboarding.habit.unit': 'дні поспіль',
  'onboarding.habit.best': 'Рекорд: 12 днів',
  'onboarding.habit.weekdays': 'П,В,С,Ч,П,С,Н',
  'onboarding.habit.freeze_note': 'Середу прикрила тижнева заморозка',
  'onboarding.habit.review_title': 'Пропущені задачі повертаються',
  'onboarding.habit.review_body': 'Прокатуй їх у Рев’ю, доки не закріпляться',
  'onboarding.habit.review_count': '3',
};

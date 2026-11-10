// onboarding area, ru. The 4-step welcome (design v2 MobOnboarding1–4);
// the web's 5-slide copy was retired with it. Edit only your area's files.
import type { Dict } from '../types';

export const onboardingRu: Dict = {
  'onboarding.skip': 'Пропустить',
  'onboarding.step': 'Шаг {n} из {total}',
  'onboarding.begin': 'Начать',
  'onboarding.continue': 'Далее',
  'onboarding.find_level': 'Определить мой уровень',
  'onboarding.skip_start': 'Пропустить — начать с {rating}',
  // Replayed by a player who already has a level (calibration done).
  'onboarding.recalibrate': 'Перекалибровать уровень',
  'onboarding.keep_level': 'Оставить мой уровень',
  'onboarding.recalibrate_note': 'Следующие 5 сессий в каждом стиле сложность будет меняться быстрее, чтобы заново найти твой уровень. Уровень и история останутся.',
  'onboarding.recalibrate_error': 'Не удалось связаться с сервером. Попробуй еще раз.',

  // 1 · Welcome (kicker = brand.name).
  'onboarding.welcome.title': 'Увидь удар\nдо того, как он придет',
  'onboarding.welcome.body': 'Короткие тактические сессии вокруг одной идеи — найди ход, который выигрывает.',

  // 2 · The training (animated back-rank mate).
  'onboarding.training.kicker': 'Тренировка',
  'onboarding.training.title': 'Один ход выигрывает.\nНайди его.',
  'onboarding.training.body': 'Каждая сессия — серия задач под твой уровень. Решай быстро и чисто — уровень пойдет следом.',
  'onboarding.training.board': 'Мат на последней горизонтали: ладья d1–d8',
  'onboarding.training.pill': 'Rd8# · решено за 4 с',

  // 3 · Your path (the rank eyes).
  'onboarding.path.kicker': 'Твой путь',
  'onboarding.path.title': 'Каждый уровень\nпробуждает новый глаз',
  'onboarding.path.body': 'Поднимайся от Новичка до Эксперта. Ранг идет за уровнем — и может упасть, если перестанешь тренироваться.',
  'onboarding.path.you': '{level} · ты',

  // 4 · The habit (sample streak card; illustrative values).
  'onboarding.habit.kicker': 'Привычка',
  'onboarding.habit.title': 'Несколько минут в день',
  'onboarding.habit.body': 'Поддерживай огонь — одна заморозка в неделю прикрывает пропущенный день.',
  'onboarding.habit.days': '4',
  'onboarding.habit.unit': 'дня подряд',
  'onboarding.habit.best': 'Рекорд: 12 дней',
  'onboarding.habit.weekdays': 'П,В,С,Ч,П,С,В',
  'onboarding.habit.freeze_note': 'Среду прикрыла недельная заморозка',
  'onboarding.habit.review_title': 'Пропущенные задачи возвращаются',
  'onboarding.habit.review_body': 'Прорешивай их в Повторении, пока не закрепятся',
  'onboarding.habit.review_count': '3',
};

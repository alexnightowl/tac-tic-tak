'use client';

import { createTranslator, DICTS, type Dict, type Language as CoreLanguage, type Translator } from '@tac/core/i18n';

import { useAppStore, Language } from './store';

// One dictionary for the app and the web (D31): the strings come from
// @tac/core/i18n. The old web onboarding keys stay here until W1 brings
// the app's onboarding (docs/web/PLAN.md).
const LEGACY: Record<Language, Dict> = {
  en: {
    'onboarding.back': 'Back',
    'onboarding.next': 'Next',
    'onboarding.done': 'Let\'s go',
    'onboarding.styles.title': 'Bullet, blitz, rapid — pick your pace',
    'onboarding.styles.body': 'Three training styles, each with its own rating. Bullet rewards raw pattern recognition under tight time, blitz balances speed and depth, rapid is for deep calculation. Pick whichever matches the time-control you actually play.',
    'onboarding.calibration.title': 'First five sessions: calibration',
    'onboarding.calibration.body': 'Your starting rating is provisional. The first five sessions in each style let the system find your real level — your rating shows a "?" badge until calibration finishes. Manual rating selection is locked here so the result reflects your actual strength.',
    'onboarding.streak.title': 'Show up daily, drill what you missed',
    'onboarding.streak.body': 'A daily streak rewards consistency — one freeze a week covers a missed day, automatic. Failed or slow puzzles flow into Review, where you can drill them without time pressure. Achievements unlock for streaks, ratings, and exploring the app.',
    'onboarding.start.title': 'Pick a style and start',
    'onboarding.start.body': 'We\'ll drop you on the play screen — pick a style, choose a duration, and go. You can replay this walkthrough any time from Settings → App.',
  },
  uk: {
    'onboarding.back': 'Назад',
    'onboarding.next': 'Далі',
    'onboarding.done': 'Почати',
    'onboarding.styles.title': 'Пуля, бліц, рапід — обери темп',
    'onboarding.styles.body': 'Три стилі тренування, кожен зі своїм рейтингом. Пуля — швидке розпізнавання патернів, бліц балансує швидкість і глибину, рапід — для глибоких розрахунків. Обирай той що відповідає часовому контролю в реальній грі.',
    'onboarding.calibration.title': 'Перші 5 сесій: калібровка',
    'onboarding.calibration.body': 'Стартовий рейтинг провізорний. Перші пʼять сесій у кожному стилі дають системі знайти твій реальний рівень — поряд з рейтингом світиться «?». Ручний вибір рейтингу заблоковано спеціально, щоб результат відображав реальну силу.',
    'onboarding.streak.title': 'Грай щодня, повторюй що пропустив',
    'onboarding.streak.body': 'Щоденний стрік нагороджує сталість — одна заморозка на тиждень автоматично прикриває пропущений день. Провалені і повільні задачі попадають у Ревʼю, де можна спокійно їх прокатати без таймера. Ачівки відкриваються за стріки, рейтинги і відкриття функцій.',
    'onboarding.start.title': 'Обирай стиль і починай',
    'onboarding.start.body': 'Зараз перейдемо на екран гри — обери стиль, тривалість, поїхали. Цей онбординг можна перепройти у Налаштуваннях → Програма.',
  },
};

const dicts: Record<Language, Dict> = {
  en: { ...DICTS.en, ...LEGACY.en },
  uk: { ...DICTS.uk, ...LEGACY.uk },
};

// The core's Language also has ru / es (the app's); this web stays en / uk
// (createTranslator falls back to en for a language it has no dict for).
const coreDicts = dicts as Record<CoreLanguage, Dict>;
const translators: Record<Language, Translator> = {
  en: createTranslator('en', coreDicts),
  uk: createTranslator('uk', coreDicts),
};

/** The translator for a language outside render (async callbacks that outlive a language switch). */
export function tFor(lang: Language): Translator['t'] {
  return (translators[lang] ?? translators.en).t;
}

/** `t(key, vars?)`: lang dict → en dict → key, `{var}` interpolation. */
export function useT(): Translator['t'] {
  const lang = useAppStore((s) => s.settings.language);
  return (translators[lang] ?? translators.en).t;
}

/**
 * Plural-aware lookup: `${key}.${form}` for the CLDR plural category of
 * the count, with core's fallback chain so a partial dict never crashes.
 */
export function useTn(): Translator['tn'] {
  const lang = useAppStore((s) => s.settings.language);
  return (translators[lang] ?? translators.en).tn;
}

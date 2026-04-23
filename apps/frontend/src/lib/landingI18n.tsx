'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

export type LandingLang = 'en' | 'uk';

// Shared with the in-app store so the choice carries from the landing into
// the login/register pages and, for brand-new accounts, into their saved
// user settings.
const STORAGE_KEY = 'taktic.lang';

type Dict = Record<string, string>;

const EN: Dict = {
  'nav.login': 'Log in',
  'nav.signup': 'Sign up',
  'nav.features': 'Features',
  'nav.training': 'Training',
  'nav.statistics': 'Statistics',
  'nav.about': 'About',

  'hero.eyebrow': 'Chess tactics, done right',
  'hero.title_1': 'Sharpen',
  'hero.title_2': 'your instincts',
  'hero.subtitle':
    'Tacticore trains your chess tactics smarter, faster, every day. Adaptive puzzles, per-style ratings, real progression.',
  'hero.cta_primary': 'Start training',
  'hero.cta_primary_short': 'Get started',
  'hero.cta_secondary': 'I have an account',
  'hero.stat_styles': 'Styles',
  'hero.stat_adaptive': 'Adaptive',
  'hero.stat_tiers': 'Tiers',
  'hero.float_your_turn': 'Your turn',
  'hero.float_find_best': 'Find the best move',
  'hero.float_levelup': 'Level-up',

  'value.eyebrow': 'Why it works',
  'value.title': 'Built around how you actually improve',
  'value.subtitle':
    "Grinding random puzzles doesn't build skill — calibrated pressure does. Each piece of the app is designed around a specific training principle.",
  'value.adaptive.title': 'Adaptive difficulty',
  'value.adaptive.body':
    'Puzzle rating drifts toward yours after every attempt. Too easy? Next one climbs. Stuck? It eases off. You always train at the edge of your ability.',
  'value.per_style.title': 'Per-style training',
  'value.per_style.body':
    "Bullet sharpens pattern recognition. Rapid builds deep calculation. We track them separately so your bullet rating can't smuggle weak rapid habits.",
  'value.gate.title': 'Real level-up gate',
  'value.gate.body':
    'Rating ceilings only rise when you meet four targets in a single session — count, accuracy, speed, peak. No shortcuts, no grinding for numbers.',

  'features.eyebrow': 'Everything you need',
  'features.title': 'The full toolkit, out of the box',
  'features.subtitle':
    'No pay-wall for the things that matter. The whole trainer — styles, review, social — is in the product from day one.',
  'features.styles.title': 'Three training styles',
  'features.styles.body':
    'Bullet (1–3 min), Blitz (5–15 min), Rapid (10–30 min) — each with its own rating, pace and unlock formula.',
  'features.focus.title': 'Focus mode',
  'features.focus.body':
    'Fullscreen, stats hidden, zero distractions. Nothing to look at but the position in front of you.',
  'features.progress.title': 'Live level-up progress',
  'features.progress.body':
    'Every move ticks a progress bar toward the next unlock. You always know how close you are.',
  'features.social.title': 'Friends & leaderboards',
  'features.social.body':
    "Add people by nickname, climb the style-specific boards, see friends-only standings when it's personal.",
  'features.review.title': 'Review what you missed',
  'features.review.body':
    'Failed puzzles queue into a timerless Review mode. Work them out without pressure until they stick.',
  'features.custom.title': 'Make it yours',
  'features.custom.body':
    "Pick your board theme, piece set, accent colour, sound pack. The app should feel like your setup, not ours.",
  'features.banner':
    'Over 4 million Lichess puzzles, curated by rating and theme. Every session pulls fresh positions calibrated to where you are right now.',

  'how.eyebrow': 'How it works',
  'how.title': 'Three steps. Real progress.',
  'how.subtitle':
    "You're not accumulating a vanity number. Each level-up is a specific, earned moment — and the bar shows you exactly how close you are to it.",
  'how.step_1.title': 'Pick your style',
  'how.step_1.body':
    'Bullet, Blitz or Rapid. Choose a duration preset and the difficulty you want to push against — the slider shows where your cap is.',
  'how.step_2.title': 'Solve under pressure',
  'how.step_2.body':
    'The board fills the screen, the timer runs, puzzles adapt to you after every attempt. Missed moves are automatically queued for later review.',
  'how.step_3.title': 'Hit all four to level up',
  'how.step_3.body':
    'Finish the session with enough solved, high enough accuracy, fast enough, with enough peak rating. Nail all four and your ceiling goes up.',

  'cta.title_1': 'Your next rating jump is',
  'cta.title_2': 'one session away.',
  'cta.subtitle':
    'No email, no payment, no onboarding form. Pick a nickname, pick a style, start solving.',
  'cta.primary': 'Create account',
  'cta.secondary': 'Log in',

  'footer.login': 'Log in',
  'footer.signup': 'Sign up',
  'footer.puzzles': 'Puzzles via Lichess',
};

const UK: Dict = {
  'nav.login': 'Увійти',
  'nav.signup': 'Реєстрація',
  'nav.features': 'Фічі',
  'nav.training': 'Тренування',
  'nav.statistics': 'Статистика',
  'nav.about': 'Про нас',

  'hero.eyebrow': 'Шахові тактики, як слід',
  'hero.title_1': 'Загостри',
  'hero.title_2': 'свої інстинкти',
  'hero.subtitle':
    'Tacticore тренує твої шахові тактики розумніше, швидше, щодня. Адаптивні задачі, рейтинги по стилях, реальний прогрес.',
  'hero.cta_primary': 'Почати тренування',
  'hero.cta_primary_short': 'Старт',
  'hero.cta_secondary': 'У мене вже є акаунт',
  'hero.stat_styles': 'Стилі',
  'hero.stat_adaptive': 'Адаптивно',
  'hero.stat_tiers': 'Рівні',
  'hero.float_your_turn': 'Ваш хід',
  'hero.float_find_best': 'Знайдіть найкращий хід',
  'hero.float_levelup': 'Левел-ап',

  'value.eyebrow': 'Чому це працює',
  'value.title': 'Побудовано навколо того, як ти реально прогресуєш',
  'value.subtitle':
    'Рішати випадкові задачі — не тренування. Працює лише дозована напруга. Кожна деталь додатку зав’язана на конкретний принцип тренування.',
  'value.adaptive.title': 'Адаптивна складність',
  'value.adaptive.body':
    'Рейтинг задач підлаштовується під твій після кожної спроби. Легко — наступна буде складнішою. Застряг — стане простіше. Ти завжди тренуєшся на межі своїх можливостей.',
  'value.per_style.title': 'Тренування по стилях',
  'value.per_style.body':
    'Пуля заточує розпізнавання патернів. Рапід розвиває глибокий розрахунок. Ми рахуємо їх окремо, щоб твій пулевий рейтинг не приховував слабких рапідних звичок.',
  'value.gate.title': 'Чесний левел-ап',
  'value.gate.body':
    'Стеля рейтингу підіймається лише коли ти за одну сесію досягаєш чотирьох цілей: кількість, точність, швидкість, пік. Без обхідних шляхів, без накрутки цифр.',

  'features.eyebrow': 'Усе що потрібно',
  'features.title': 'Повний набір інструментів одразу',
  'features.subtitle':
    'Жодного пейволу на важливому. Увесь тренажер — стилі, рев’ю, соціалка — у продукті з першого дня.',
  'features.styles.title': 'Три стилі тренування',
  'features.styles.body':
    'Пуля (1–3 хв), Бліц (5–15 хв), Рапід (10–30 хв) — у кожного свій рейтинг, темп і формула розблокування.',
  'features.focus.title': 'Режим фокусу',
  'features.focus.body':
    'Повний екран, статистика схована, жодних відволікань. Є лише позиція перед тобою — і все.',
  'features.progress.title': 'Живий прогрес до левел-апу',
  'features.progress.body':
    'Кожен хід наповнює смужку прогресу до наступного розблокування. Ти завжди знаєш, скільки лишилось.',
  'features.social.title': 'Друзі та лідерборди',
  'features.social.body':
    'Додавай людей за ніком, підіймайся в бордах по стилях, дивись рейтинг серед друзів — коли це особисто.',
  'features.review.title': 'Розбирай помилки',
  'features.review.body':
    'Провалені задачі автоматично потрапляють у Рев’ю без таймера. Розбирай їх спокійно, поки не засвоїш.',
  'features.custom.title': 'Підлаштуй під себе',
  'features.custom.body':
    'Обирай тему дошки, набір фігур, акцентний колір, пак звуків. Додаток має відчуватись як твій, а не наш.',
  'features.banner':
    'Понад 4 мільйони задач з Lichess, відібраних за рейтингом і темою. Кожна сесія підтягує свіжі позиції рівно під твій поточний рівень.',

  'how.eyebrow': 'Як це працює',
  'how.title': 'Три кроки. Реальний прогрес.',
  'how.subtitle':
    'Ти не накопичуєш «красиве» число. Кожен левел-ап — конкретний зароблений момент, і смужка показує, скільки лишилося до нього.',
  'how.step_1.title': 'Обери стиль',
  'how.step_1.body':
    'Пуля, Бліц чи Рапід. Вибери тривалість і складність, проти якої хочеш іти — слайдер показує твою стелю.',
  'how.step_2.title': 'Вирішуй під тиском',
  'how.step_2.body':
    'Дошка на весь екран, таймер іде, задачі підлаштовуються під тебе після кожної спроби. Пропущені ходи автоматично додаються в рев’ю.',
  'how.step_3.title': 'Виконай усі чотири — левел-ап',
  'how.step_3.body':
    'Заверши сесію з достатньою кількістю розвʼязаних, достатньою точністю, швидкістю й піком рейтингу. Виконав усі чотири — стеля росте.',

  'cta.title_1': 'Твій наступний ривок у рейтингу',
  'cta.title_2': 'уже в одній сесії.',
  'cta.subtitle':
    'Жодного email, жодної оплати, жодної анкети. Обери нік, обери стиль, починай рішати.',
  'cta.primary': 'Створити акаунт',
  'cta.secondary': 'Увійти',

  'footer.login': 'Увійти',
  'footer.signup': 'Реєстрація',
  'footer.puzzles': 'Задачі — з Lichess',
};

const DICTS: Record<LandingLang, Dict> = { en: EN, uk: UK };

type Ctx = {
  lang: LandingLang;
  setLang: (l: LandingLang) => void;
  t: (key: string) => string;
};

const LandingLangCtx = createContext<Ctx>({
  lang: 'en',
  setLang: () => {},
  t: (k) => EN[k] ?? k,
});

export function LandingLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LandingLang>('en');

  // Hydrate the preferred language: stored choice > browser hint > English.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as LandingLang | null;
      if (stored === 'en' || stored === 'uk') {
        setLangState(stored);
        return;
      }
    } catch {}
    if (typeof navigator !== 'undefined') {
      const hint = (navigator.language || 'en').toLowerCase();
      if (hint.startsWith('uk') || hint.startsWith('ru')) {
        setLangState('uk');
      }
    }
  }, []);

  const setLang = useCallback((l: LandingLang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const value = useMemo<Ctx>(() => ({
    lang,
    setLang,
    t: (k: string) => DICTS[lang][k] ?? EN[k] ?? k,
  }), [lang, setLang]);

  return <LandingLangCtx.Provider value={value}>{children}</LandingLangCtx.Provider>;
}

export function useLandingT() {
  return useContext(LandingLangCtx);
}

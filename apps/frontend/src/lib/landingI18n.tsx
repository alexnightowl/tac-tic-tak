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
  'nav.get_started': 'Get started',
  'nav.paces': 'Paces',
  'nav.ranks': 'Ranks',
  'nav.features': 'Features',
  'nav.how': 'How it works',

  'hero.eyebrow': 'TACTICS TRAINER · 4M+ LICHESS PUZZLES',
  'hero.title_1': 'Sharpen your',
  'hero.title_2': 'instincts.',
  'hero.subtitle':
    'Adaptive puzzles that meet you at the edge of your ability — with a separate rating for every pace and ranks you actually earn.',
  'hero.cta_primary': 'Start training',
  'hero.cta_secondary': 'I have an account',
  'hero.stat_paces': '3 paces, 3 ratings',
  'hero.stat_ranks': '5 ranks to climb',
  'hero.stat_motifs': '42 tactical motifs',
  'hero.float_turn': 'Your turn',
  'hero.float_find': 'Find the best move for white',
  'hero.float_rating': 'BLITZ RATING',

  'rank.novice': 'Novice',
  'rank.beginner': 'Beginner',
  'rank.intermediate': 'Intermediate',
  'rank.advanced': 'Advanced',
  'rank.expert': 'Expert',

  'motifs.label': '42 MOTIFS\nFROM LICHESS',

  'paces.eyebrow': 'Three paces',
  'paces.title': 'Three paces. Three ratings.',
  'paces.subtitle':
    "Bullet reflexes and rapid calculation are different skills, so they never share a number. A fast session can't hide slow habits.",
  'paces.rating_label': 'SEPARATE RATING',
  'paces.rapid.name': 'Rapid',
  'paces.rapid.time': '10–30 min',
  'paces.rapid.body': 'Deep calculation. Longer think-time, harder positions, fewer of them.',
  'paces.blitz.name': 'Blitz',
  'paces.blitz.time': '5–15 min',
  'paces.blitz.body': 'The all-rounder. Balanced pace and difficulty — where most sharpening happens.',
  'paces.bullet.name': 'Bullet',
  'paces.bullet.time': '1–3 min',
  'paces.bullet.body': 'Pure pattern recognition. See it, play it, next — before the doubt kicks in.',

  'ranks.eyebrow': 'Five ranks',
  'ranks.title': 'Ranks you earn, not grind.',
  'ranks.subtitle':
    'From Novice to Expert, each rank is a band of puzzle difficulty. Your norm only rises when one session clears all four targets — enough solved, accurate, fast, and a high enough peak.',
  'ranks.point_1': 'Difficulty drifts toward you after every puzzle',
  'ranks.point_2': 'Unlock higher bands only by clearing the gate',
  'ranks.point_3': 'The sharingan deepens as you climb',
  'ranks.panel_rating': 'BLITZ RATING',
  'ranks.gate': 'LEVEL-UP GATE',
  'ranks.gate_badge': '4 / 4 · NORM +50',
  'ranks.gate_solved': 'Solved',
  'ranks.gate_accuracy': 'Accuracy',
  'ranks.gate_speed': 'Avg speed',
  'ranks.gate_peak': 'Peak rating',

  'features.eyebrow': 'The toolkit',
  'features.title': "Everything a trainer needs. Nothing it doesn't.",
  'features.subtitle': 'No paywall on the parts that matter. Review, motifs, stats and social are in from day one.',
  'features.review.title': 'Review what you missed',
  'features.review.body': 'Every miss lands in a timerless Review queue. Work it out without pressure until it sticks.',
  'features.focus.title': 'Focus mode',
  'features.focus.body': 'Fullscreen, stats hidden. Nothing on screen but the position in front of you.',
  'features.motif.title': 'Drill by motif',
  'features.motif.body': 'Pick any of 42 Lichess themes and grind exactly the pattern that keeps beating you.',
  'features.stats.title': 'Honest statistics',
  'features.stats.body': 'Per-pace rating history, a year of activity, and your weakest themes — ranked.',
  'features.social.title': 'Friends & leaderboards',
  'features.social.body': 'Add people by nickname and climb pace-specific boards, globally or among friends.',
  'features.board.title': 'Stone & marble',
  'features.board.body': 'A board carved for long sessions: marble and slate squares, ember pieces, calm highlights.',

  'how.eyebrow': 'How it works',
  'how.title': 'Three steps to the next rank.',
  'how.step_1.title': 'Pick a pace',
  'how.step_1.body': 'Rapid, Blitz or Bullet. Choose a duration and the difficulty you want to push against.',
  'how.step_2.title': 'Solve under pressure',
  'how.step_2.body': 'The board fills the screen, the clock runs, and every puzzle adapts to your last answer.',
  'how.step_3.title': 'Earn the next rank',
  'how.step_3.body': 'Hit all four session targets and your norm rises. No grinding for numbers, no shortcuts.',

  'cta.title_1': 'Your next rank is',
  'cta.title_2': 'one session away.',
  'cta.subtitle': 'No email, no payment, no onboarding form. Pick a nickname, pick a pace, start solving.',
  'cta.primary': 'Create account',
  'cta.secondary': 'Log in',

  'footer.login': 'Log in',
  'footer.signup': 'Sign up',
  'footer.puzzles': 'Puzzles via Lichess',
  'footer.credits': 'Theme icons: game-icons.net, CC BY 3.0',
};

const UK: Dict = {
  'nav.login': 'Увійти',
  'nav.signup': 'Реєстрація',
  'nav.get_started': 'Почати',
  'nav.paces': 'Темпи',
  'nav.ranks': 'Ранги',
  'nav.features': 'Можливості',
  'nav.how': 'Як це працює',

  'hero.eyebrow': 'ТРЕНАЖЕР ТАКТИКИ · 4М+ ЗАДАЧ LICHESS',
  'hero.title_1': 'Загостри свої',
  'hero.title_2': 'інстинкти.',
  'hero.subtitle':
    'Адаптивні задачі на межі твоїх можливостей — з окремим рейтингом для кожного темпу і рангами, які треба заслужити.',
  'hero.cta_primary': 'Почати тренування',
  'hero.cta_secondary': 'Маю акаунт',
  'hero.stat_paces': '3 темпи, 3 рейтинги',
  'hero.stat_ranks': '5 рангів',
  'hero.stat_motifs': '42 тактичні мотиви',
  'hero.float_turn': 'Твій хід',
  'hero.float_find': 'Знайди найкращий хід за білих',
  'hero.float_rating': 'РЕЙТИНГ БЛІЦ',

  'rank.novice': 'Новачок',
  'rank.beginner': 'Початківець',
  'rank.intermediate': 'Середній',
  'rank.advanced': 'Просунутий',
  'rank.expert': 'Експерт',

  'motifs.label': '42 МОТИВИ\nЗ LICHESS',

  'paces.eyebrow': 'Три темпи',
  'paces.title': 'Три темпи. Три рейтинги.',
  'paces.subtitle':
    'Рефлекси в булеті й розрахунок у рапіді — різні навички, тому в них ніколи не спільне число. Швидка сесія не сховає повільних звичок.',
  'paces.rating_label': 'ОКРЕМИЙ РЕЙТИНГ',
  'paces.rapid.name': 'Рапід',
  'paces.rapid.time': '10–30 хв',
  'paces.rapid.body': 'Глибокий розрахунок. Більше часу на роздуми, складніші позиції, менше їх.',
  'paces.blitz.name': 'Бліц',
  'paces.blitz.time': '5–15 хв',
  'paces.blitz.body': 'Універсал. Збалансовані темп і складність — тут відбувається найбільше заточування.',
  'paces.bullet.name': 'Булет',
  'paces.bullet.time': '1–3 хв',
  'paces.bullet.body': 'Чисте розпізнавання патернів. Побачив, зіграв, далі — поки не встигли закрастися сумніви.',

  'ranks.eyebrow': 'П’ять рангів',
  'ranks.title': 'Ранги заслуговують, а не набивають.',
  'ranks.subtitle':
    'Від Новачка до Експерта: кожен ранг — це діапазон складності задач. Твоя норма росте лише тоді, коли одна сесія закриває всі чотири цілі — достатньо розв’язаних, точність, швидкість і пік рейтингу.',
  'ranks.point_1': 'Складність підлаштовується після кожної задачі',
  'ranks.point_2': 'Вищі рівні відкриваються лише через гейт',
  'ranks.point_3': 'Шарінган глибшає, коли ти ростеш',
  'ranks.panel_rating': 'РЕЙТИНГ БЛІЦ',
  'ranks.gate': 'ГЕЙТ РІВНЯ',
  'ranks.gate_badge': '4 / 4 · НОРМА +50',
  'ranks.gate_solved': 'Розв’язано',
  'ranks.gate_accuracy': 'Точність',
  'ranks.gate_speed': 'Сер. швидкість',
  'ranks.gate_peak': 'Пік рейтингу',

  'features.eyebrow': 'Інструменти',
  'features.title': 'Усе, що треба тренажеру. Нічого зайвого.',
  'features.subtitle': 'Жодного пейволу на важливе. Ревʼю, мотиви, статистика й друзі — з першого дня.',
  'features.review.title': 'Ревʼю помилок',
  'features.review.body': 'Кожна помилка потрапляє в чергу Ревʼю без таймера. Розбирай без тиску, поки не засвоїш.',
  'features.focus.title': 'Режим фокусу',
  'features.focus.body': 'Повний екран, статистика схована. Нічого, крім позиції перед тобою.',
  'features.motif.title': 'Тренування за мотивом',
  'features.motif.body': 'Обери будь-яку з 42 тем Lichess і відпрацьовуй саме той патерн, що тебе постійно ловить.',
  'features.stats.title': 'Чесна статистика',
  'features.stats.body': 'Історія рейтингу для кожного темпу, рік активності й найслабші теми — за рейтингом.',
  'features.social.title': 'Друзі й лідерборди',
  'features.social.body': 'Додавай людей за ніком і піднімайся в таблицях кожного темпу — глобально чи серед друзів.',
  'features.board.title': 'Камінь і мармур',
  'features.board.body': 'Дошка для довгих сесій: мармурові й сланцеві клітинки, фігури Ember, спокійні підсвітки.',

  'how.eyebrow': 'Як це працює',
  'how.title': 'Три кроки до наступного рангу.',
  'how.step_1.title': 'Обери темп',
  'how.step_1.body': 'Рапід, Бліц або Булет. Обери тривалість і складність, проти якої хочеш тиснути.',
  'how.step_2.title': 'Розв’язуй під тиском',
  'how.step_2.body': 'Дошка на весь екран, годинник іде, кожна задача підлаштовується під твою попередню відповідь.',
  'how.step_3.title': 'Заслужи наступний ранг',
  'how.step_3.body': 'Закрий усі чотири цілі сесії — і твоя норма зросте. Без накручування цифр і без обхідних шляхів.',

  'cta.title_1': 'Твій наступний ранг —',
  'cta.title_2': 'за одну сесію.',
  'cta.subtitle': 'Жодного email, жодної оплати, жодної анкети. Обери нік, обери темп і починай розв’язувати.',
  'cta.primary': 'Створити акаунт',
  'cta.secondary': 'Увійти',

  'footer.login': 'Увійти',
  'footer.signup': 'Реєстрація',
  'footer.puzzles': 'Задачі — з Lichess',
  'footer.credits': 'Іконки тем: game-icons.net, CC BY 3.0',
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

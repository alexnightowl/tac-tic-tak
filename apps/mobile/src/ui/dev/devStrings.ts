import type { Language } from '@tac/core/i18n';

import { useLang } from '../lang';

// Dev-route-only copy (section headers, state names). Kept out of
// @tac/core/i18n on purpose: none of it ships in a product screen.
const DEV: Record<Language, Record<string, string>> = {
  en: {
    plates: 'Plate buttons',
    surfaces: 'Surfaces',
    segmented: 'Segmented',
    toggle: 'Toggle',
    inputs: 'Inputs',
    text: 'Text variants',
    candidates: 'uk display candidates',
    candidatesHint: 'Cinzel (en) beside each Cyrillic face — pick one (PLAN §8 #2).',
    normal: 'normal',
    pressed: 'pressed',
    disabled: 'disabled',
    loading: 'loading',
    block: 'block',
    on: 'on',
    off: 'off',
    card: 'Card',
    hero: 'HeroCard',
    well: 'Well',
    filled: 'filled',
    error: 'error',
    empty: 'empty',
    renders: 'renders',
    refresh: 'Refresh counts',
    mockBody: 'Mock tab page. Switch tabs and languages; compare with the other bar.',
    native: 'NativeTabs (system)',
    custom: 'Custom JS bar',
  },
  uk: {
    plates: 'Кнопки-плити',
    surfaces: 'Поверхні',
    segmented: 'Сегменти',
    toggle: 'Перемикач',
    inputs: 'Поля вводу',
    text: 'Варіанти тексту',
    candidates: 'Кандидати для uk-заголовків',
    candidatesHint: 'Cinzel (en) поруч із кожним кириличним шрифтом — обери один (PLAN §8 #2).',
    normal: 'звичайна',
    pressed: 'натиснута',
    disabled: 'вимкнена',
    loading: 'завантаження',
    block: 'на всю ширину',
    on: 'увімк.',
    off: 'вимк.',
    card: 'Card',
    hero: 'HeroCard',
    well: 'Well',
    filled: 'заповнене',
    error: 'помилка',
    empty: 'порожнє',
    renders: 'рендери',
    refresh: 'Оновити лічильники',
    mockBody: 'Макет вкладки. Перемикай вкладки й мови; порівняй з іншою панеллю.',
    native: 'NativeTabs (системна)',
    custom: 'Власна JS-панель',
  },
};

export function useDevT(): (key: keyof (typeof DEV)['en']) => string {
  const { lang } = useLang();
  return (key) => DEV[lang][key] ?? DEV.en[key];
}

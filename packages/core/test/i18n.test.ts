import { describe, expect, it } from 'vitest';
import {
  AREAS, AREA_DICTS, DICTS, LANDING_DICTS, createTranslator, interpolate, pluralizeUk, type Dict,
} from '../src/i18n';

function missing(a: Dict, b: Dict): string[] {
  return Object.keys(a).filter((k) => !(k in b)).sort();
}

describe('dictionary parity', () => {
  // Known gaps in the web source, kept verbatim (do not invent copy).
  // en has only one/other plural forms; uk has one/few/many and no other.
  const APP_ONLY_EN = ['review.puzzle_word.other'];
  const APP_ONLY_UK = ['review.puzzle_word.few', 'review.puzzle_word.many'];

  it('app en/uk keys match apart from plural forms', () => {
    expect(missing(DICTS.en, DICTS.uk)).toEqual(APP_ONLY_EN);
    expect(missing(DICTS.uk, DICTS.en)).toEqual(APP_ONLY_UK);
  });

  it('each area has the same keys in en and uk (plural forms aside)', () => {
    for (const a of AREAS) {
      const { en, uk } = AREA_DICTS[a];
      const plural = (k: string) => /\.(zero|one|two|few|many|other)$/.test(k);
      expect(missing(en, uk).filter((k) => !plural(k)), `${a}: en keys missing in uk`).toEqual([]);
      expect(missing(uk, en).filter((k) => !plural(k)), `${a}: uk keys missing in en`).toEqual([]);
    }
  });

  it('every plural key has its en one/other and uk one/few/many forms', () => {
    const forms = (d: Dict) => {
      const m = new Map<string, Set<string>>();
      for (const k of Object.keys(d)) {
        const hit = /^(.*)\.(zero|one|two|few|many|other)$/.exec(k);
        if (hit) m.set(hit[1], (m.get(hit[1]) ?? new Set()).add(hit[2]));
      }
      return m;
    };
    const en = forms(DICTS.en);
    const uk = forms(DICTS.uk);
    expect([...en.keys()].sort()).toEqual([...uk.keys()].sort());
    for (const [base, f] of en) expect([...f].sort(), `en ${base}`).toEqual(expect.arrayContaining(['one', 'other']));
    for (const [base, f] of uk) expect([...f].sort(), `uk ${base}`).toEqual(expect.arrayContaining(['few', 'many', 'one']));
  });

  it('no key is defined in two areas', () => {
    for (const lang of ['en', 'uk'] as const) {
      const seen = new Map<string, string>();
      for (const a of AREAS) {
        for (const k of Object.keys(AREA_DICTS[a][lang])) {
          expect(seen.get(k), `${lang} '${k}' in ${seen.get(k)} and ${a}`).toBeUndefined();
          seen.set(k, a);
        }
      }
    }
  });

  it('landing en/uk keys match', () => {
    expect(missing(LANDING_DICTS.en, LANDING_DICTS.uk)).toEqual([]);
    expect(missing(LANDING_DICTS.uk, LANDING_DICTS.en)).toEqual([]);
  });

  it('every {token} in en also appears in uk', () => {
    const tokens = (s: string) => (s.match(/\{[a-z_]+\}/gi) ?? []).sort();
    for (const [k, v] of Object.entries(DICTS.en)) {
      if (!(k in DICTS.uk)) continue;
      expect(tokens(DICTS.uk[k]), k).toEqual(tokens(v));
    }
  });

  it('no string repeats a token (split/join == web first-only replace)', () => {
    for (const d of [DICTS.en, DICTS.uk, LANDING_DICTS.en, LANDING_DICTS.uk]) {
      for (const [k, v] of Object.entries(d)) {
        const toks = v.match(/\{[a-z_]+\}/gi) ?? [];
        expect(new Set(toks).size, k).toBe(toks.length);
      }
    }
  });
});

describe('createTranslator', () => {
  it('looks up, falls back to en, then to the key', () => {
    const t = createTranslator('uk').t;
    expect(t('play')).toBe('Гра');
    expect(t('nope.missing')).toBe('nope.missing');
    expect(createTranslator('en').t('home')).toBe('Home');
    // unknown lang behaves like en (web: DICTS[lang] ?? DICTS.en)
    expect(createTranslator('xx' as never).t('home')).toBe('Home');
  });

  it('interpolates {vars}', () => {
    const { t } = createTranslator('en');
    expect(t('play.off_form_cta', { rating: 1200 })).toBe('Lower to 1200');
    expect(t('achv.progress_value', { done: 3, total: 23 })).toBe('3 of 23 unlocked');
    expect(t('play.off_form_cta')).toBe('Lower to {rating}');
    expect(interpolate('{a}-{b}', { a: '$&' })).toBe('$&-{b}');
  });

  it('serves landing copy from LANDING_DICTS', () => {
    expect(createTranslator('uk', LANDING_DICTS).t('nav.paces')).toBe('Темпи');
    expect(createTranslator('uk', LANDING_DICTS).t('play')).toBe('play');
  });
});

describe('plurals', () => {
  const N = [1, 2, 5, 11, 21, 22, 25];

  it('pluralizeUk follows CLDR one/few/many', () => {
    expect(N.map(pluralizeUk)).toEqual(['one', 'few', 'many', 'many', 'one', 'few', 'many']);
    expect([0, 12, 14, 111, 112, 101, 104].map(pluralizeUk))
      .toEqual(['many', 'many', 'many', 'many', 'many', 'one', 'few']);
    expect(pluralizeUk(1.5)).toBe('other');
  });

  it('Intl.PluralRules agrees with pluralizeUk on integers', () => {
    const pr = new Intl.PluralRules('uk');
    for (let n = 0; n <= 250; n++) expect(pluralizeUk(n), String(n)).toBe(pr.select(n));
  });

  it('tn picks uk forms', () => {
    const { tn } = createTranslator('uk');
    expect(N.map((n) => tn('review.puzzle_word', n)))
      .toEqual(['задача', 'задачі', 'задач', 'задач', 'задача', 'задачі', 'задач']);
    // 'other' (fractions) is absent in uk → falls to .many, as on the web
    expect(tn('review.puzzle_word', 1.5)).toBe('задач');
  });

  it('tn picks en forms', () => {
    const { tn } = createTranslator('en');
    expect(N.map((n) => tn('review.puzzle_word', n)))
      .toEqual(['puzzle', 'puzzles', 'puzzles', 'puzzles', 'puzzles', 'puzzles', 'puzzles']);
    expect(tn('no.such', 3)).toBe('no.such');
  });
});

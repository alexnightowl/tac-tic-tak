import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_DEFS } from '../../../apps/backend/src/achievements/registry';
import {
  ACHIEVEMENT_CATALOG, ACHIEVEMENT_CATEGORY_ORDER, achievementIconKey, achievementMeta,
  groupAchievements, isCreatorNickname,
} from '../src/catalogs';
import { DICTS } from '../src/i18n';

describe('achievement catalogue', () => {
  it('matches the backend registry in order, category and icon', () => {
    expect(ACHIEVEMENT_CATALOG.map(({ slug, category, icon }) => ({ slug, category, icon })))
      .toEqual(ACHIEVEMENT_DEFS.map(({ slug, category, icon }) => ({ slug, category, icon })));
    expect(ACHIEVEMENT_CATALOG.map((a) => a.sort)).toEqual(ACHIEVEMENT_CATALOG.map((_, i) => i));
  });

  it('every slug and category has en + uk strings', () => {
    for (const lang of ['en', 'uk'] as const) {
      for (const a of ACHIEVEMENT_CATALOG) {
        expect(DICTS[lang], `${lang} ${a.slug}`).toHaveProperty([`achv.${a.slug}.name`]);
        expect(DICTS[lang], `${lang} ${a.slug}`).toHaveProperty([`achv.${a.slug}.desc`]);
      }
      for (const c of ACHIEVEMENT_CATEGORY_ORDER) expect(DICTS[lang]).toHaveProperty([`achv.cat.${c}`]);
    }
  });

  it('lookups', () => {
    expect(achievementMeta('streak-7')).toMatchObject({ category: 'streak', icon: 'CalendarHeart' });
    expect(achievementIconKey('star-repo')).toBe('Github');
    expect(achievementIconKey('nope')).toBeNull();
  });

  it('groups in tab order and drops empty categories', () => {
    const list = [
      { slug: 'set-bio', category: 'customize' as const },
      { slug: 'first-session', category: 'play' as const },
      { slug: 'streak-3', category: 'streak' as const },
      { slug: 'ten-sessions', category: 'play' as const },
    ];
    expect(groupAchievements(list).map((g) => [g.category, g.items.map((i) => i.slug)])).toEqual([
      ['play', ['first-session', 'ten-sessions']],
      ['streak', ['streak-3']],
      ['customize', ['set-bio']],
    ]);
  });
});

describe('creators', () => {
  it('matches case-insensitively', () => {
    expect(isCreatorNickname('LazyNightOwl')).toBe(true);
    expect(isCreatorNickname('someone')).toBe(false);
    expect(isCreatorNickname(null)).toBe(false);
    expect(isCreatorNickname('')).toBe(false);
  });
});

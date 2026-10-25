// Per-area dictionaries (Phase 4). Each feature stream edits only its own
// area files, so parallel work never collides on one big dict. Areas are
// merged into DICTS; a key must live in exactly one area (checked in
// test/i18n.test.ts).
import type { Dict, Language } from '../types';

import { commonEn } from './common.en';
import { commonUk } from './common.uk';
import { authEn } from './auth.en';
import { authUk } from './auth.uk';
import { homeEn } from './home.en';
import { homeUk } from './home.uk';
import { playEn } from './play.en';
import { playUk } from './play.uk';
import { reviewEn } from './review.en';
import { reviewUk } from './review.uk';
import { sessionsEn } from './sessions.en';
import { sessionsUk } from './sessions.uk';
import { statsEn } from './stats.en';
import { statsUk } from './stats.uk';
import { achievementsEn } from './achievements.en';
import { achievementsUk } from './achievements.uk';
import { socialEn } from './social.en';
import { socialUk } from './social.uk';
import { profileEn } from './profile.en';
import { profileUk } from './profile.uk';
import { settingsEn } from './settings.en';
import { settingsUk } from './settings.uk';
import { onboardingEn } from './onboarding.en';
import { onboardingUk } from './onboarding.uk';
import { shellEn } from './shell.en';
import { shellUk } from './shell.uk';

export const AREAS = [
  'common',
  'auth',
  'home',
  'play',
  'review',
  'sessions',
  'stats',
  'achievements',
  'social',
  'profile',
  'settings',
  'onboarding',
  'shell',
] as const;

export type Area = (typeof AREAS)[number];

export const AREA_DICTS: Record<Area, Record<Language, Dict>> = {
  common: { en: commonEn, uk: commonUk },
  auth: { en: authEn, uk: authUk },
  home: { en: homeEn, uk: homeUk },
  play: { en: playEn, uk: playUk },
  review: { en: reviewEn, uk: reviewUk },
  sessions: { en: sessionsEn, uk: sessionsUk },
  stats: { en: statsEn, uk: statsUk },
  achievements: { en: achievementsEn, uk: achievementsUk },
  social: { en: socialEn, uk: socialUk },
  profile: { en: profileEn, uk: profileUk },
  settings: { en: settingsEn, uk: settingsUk },
  onboarding: { en: onboardingEn, uk: onboardingUk },
  shell: { en: shellEn, uk: shellUk },
};

/** All areas of one language merged into a flat dict (the web shape). */
export function mergeAreas(lang: Language): Dict {
  const out: Dict = {};
  for (const a of AREAS) Object.assign(out, AREA_DICTS[a][lang]);
  return out;
}

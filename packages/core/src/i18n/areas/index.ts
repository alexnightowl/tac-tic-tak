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
import { offlineEn } from './offline.en';
import { offlineUk } from './offline.uk';
import { libraryEn } from './library.en';
import { libraryUk } from './library.uk';
import { learnEn } from './learn.en';
import { learnUk } from './learn.uk';
import { coursesEn } from './courses.en';
import { coursesUk } from './courses.uk';
import { challengeEn } from './challenge.en';
import { challengeUk } from './challenge.uk';
import { stormEn } from './storm.en';
import { stormUk } from './storm.uk';
import { dxshellEn } from './dxshell.en';
import { dxshellUk } from './dxshell.uk';
import { dxauthEn } from './dxauth.en';
import { dxauthUk } from './dxauth.uk';
import { dxhomeEn } from './dxhome.en';
import { dxhomeUk } from './dxhome.uk';
import { dxboardEn } from './dxboard.en';
import { dxboardUk } from './dxboard.uk';
import { dxlearnEn } from './dxlearn.en';
import { dxlearnUk } from './dxlearn.uk';
import { dxrivalsEn } from './dxrivals.en';
import { dxrivalsUk } from './dxrivals.uk';
import { dxaccountEn } from './dxaccount.en';
import { dxaccountUk } from './dxaccount.uk';
import { blindEn } from './blind.en';
import { blindUk } from './blind.uk';
import { hasteEn } from './haste.en';
import { hasteUk } from './haste.uk';
import { planEn } from './plan.en';
import { planUk } from './plan.uk';
import { woodpeckerEn } from './woodpecker.en';
import { woodpeckerUk } from './woodpecker.uk';
import { commonRu } from './common.ru';
import { commonEs } from './common.es';
import { authRu } from './auth.ru';
import { authEs } from './auth.es';
import { homeRu } from './home.ru';
import { homeEs } from './home.es';
import { playRu } from './play.ru';
import { playEs } from './play.es';
import { reviewRu } from './review.ru';
import { reviewEs } from './review.es';
import { sessionsRu } from './sessions.ru';
import { sessionsEs } from './sessions.es';
import { statsRu } from './stats.ru';
import { statsEs } from './stats.es';
import { achievementsRu } from './achievements.ru';
import { achievementsEs } from './achievements.es';
import { socialRu } from './social.ru';
import { socialEs } from './social.es';
import { profileRu } from './profile.ru';
import { profileEs } from './profile.es';
import { settingsRu } from './settings.ru';
import { settingsEs } from './settings.es';
import { onboardingRu } from './onboarding.ru';
import { onboardingEs } from './onboarding.es';
import { shellRu } from './shell.ru';
import { shellEs } from './shell.es';
import { offlineRu } from './offline.ru';
import { offlineEs } from './offline.es';
import { libraryRu } from './library.ru';
import { libraryEs } from './library.es';
import { learnRu } from './learn.ru';
import { learnEs } from './learn.es';
import { coursesRu } from './courses.ru';
import { coursesEs } from './courses.es';
import { challengeRu } from './challenge.ru';
import { challengeEs } from './challenge.es';
import { stormRu } from './storm.ru';
import { stormEs } from './storm.es';
import { dxshellRu } from './dxshell.ru';
import { dxshellEs } from './dxshell.es';
import { dxauthRu } from './dxauth.ru';
import { dxauthEs } from './dxauth.es';
import { dxhomeRu } from './dxhome.ru';
import { dxhomeEs } from './dxhome.es';
import { dxboardRu } from './dxboard.ru';
import { dxboardEs } from './dxboard.es';
import { dxlearnRu } from './dxlearn.ru';
import { dxlearnEs } from './dxlearn.es';
import { dxrivalsRu } from './dxrivals.ru';
import { dxrivalsEs } from './dxrivals.es';
import { dxaccountRu } from './dxaccount.ru';
import { dxaccountEs } from './dxaccount.es';
import { blindRu } from './blind.ru';
import { blindEs } from './blind.es';
import { hasteRu } from './haste.ru';
import { hasteEs } from './haste.es';
import { planRu } from './plan.ru';
import { planEs } from './plan.es';
import { woodpeckerRu } from './woodpecker.ru';
import { woodpeckerEs } from './woodpecker.es';

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
  'offline',
  'library',
  'learn',
  'courses',
  'challenge',
  'storm',
  'dxshell',
  'dxauth',
  'dxhome',
  'dxboard',
  'dxlearn',
  'dxrivals',
  'dxaccount',
  'blind',
  'haste',
  'plan',
  'woodpecker',
] as const;

export type Area = (typeof AREAS)[number];

export const AREA_DICTS: Record<Area, Record<Language, Dict>> = {
  common: { en: commonEn, uk: commonUk, ru: commonRu, es: commonEs },
  auth: { en: authEn, uk: authUk, ru: authRu, es: authEs },
  home: { en: homeEn, uk: homeUk, ru: homeRu, es: homeEs },
  play: { en: playEn, uk: playUk, ru: playRu, es: playEs },
  review: { en: reviewEn, uk: reviewUk, ru: reviewRu, es: reviewEs },
  sessions: { en: sessionsEn, uk: sessionsUk, ru: sessionsRu, es: sessionsEs },
  stats: { en: statsEn, uk: statsUk, ru: statsRu, es: statsEs },
  achievements: { en: achievementsEn, uk: achievementsUk, ru: achievementsRu, es: achievementsEs },
  social: { en: socialEn, uk: socialUk, ru: socialRu, es: socialEs },
  profile: { en: profileEn, uk: profileUk, ru: profileRu, es: profileEs },
  settings: { en: settingsEn, uk: settingsUk, ru: settingsRu, es: settingsEs },
  onboarding: { en: onboardingEn, uk: onboardingUk, ru: onboardingRu, es: onboardingEs },
  shell: { en: shellEn, uk: shellUk, ru: shellRu, es: shellEs },
  offline: { en: offlineEn, uk: offlineUk, ru: offlineRu, es: offlineEs },
  library: { en: libraryEn, uk: libraryUk, ru: libraryRu, es: libraryEs },
  learn: { en: learnEn, uk: learnUk, ru: learnRu, es: learnEs },
  courses: { en: coursesEn, uk: coursesUk, ru: coursesRu, es: coursesEs },
  challenge: { en: challengeEn, uk: challengeUk, ru: challengeRu, es: challengeEs },
  storm: { en: stormEn, uk: stormUk, ru: stormRu, es: stormEs },
  dxshell: { en: dxshellEn, uk: dxshellUk, ru: dxshellRu, es: dxshellEs },
  dxauth: { en: dxauthEn, uk: dxauthUk, ru: dxauthRu, es: dxauthEs },
  dxhome: { en: dxhomeEn, uk: dxhomeUk, ru: dxhomeRu, es: dxhomeEs },
  dxboard: { en: dxboardEn, uk: dxboardUk, ru: dxboardRu, es: dxboardEs },
  dxlearn: { en: dxlearnEn, uk: dxlearnUk, ru: dxlearnRu, es: dxlearnEs },
  dxrivals: { en: dxrivalsEn, uk: dxrivalsUk, ru: dxrivalsRu, es: dxrivalsEs },
  dxaccount: { en: dxaccountEn, uk: dxaccountUk, ru: dxaccountRu, es: dxaccountEs },
  blind: { en: blindEn, uk: blindUk, ru: blindRu, es: blindEs },
  haste: { en: hasteEn, uk: hasteUk, ru: hasteRu, es: hasteEs },
  plan: { en: planEn, uk: planUk, ru: planRu, es: planEs },
  woodpecker: { en: woodpeckerEn, uk: woodpeckerUk, ru: woodpeckerRu, es: woodpeckerEs },
};

/** All areas of one language merged into a flat dict (the web shape). */
export function mergeAreas(lang: Language): Dict {
  const out: Dict = {};
  for (const a of AREAS) Object.assign(out, AREA_DICTS[a][lang]);
  return out;
}

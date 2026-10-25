// onboarding area, en. Keys from the web dict (apps/frontend/src/lib/i18n.ts) keep
// their web text verbatim; mobile-only keys follow. Edit only your area's files.
import type { Dict } from '../types';

export const onboardingEn: Dict = {
  'onboarding.skip': 'Skip',
  'onboarding.back': 'Back',
  'onboarding.next': 'Next',
  'onboarding.done': 'Let\'s go',
  'onboarding.welcome.title': 'Welcome to tac·tic·tak',
  'onboarding.welcome.body': 'Sharpen your tactical instincts in short, focused sessions. Real progression — every solved puzzle moves your rating, every session tells the system what to throw at you next.',
  'onboarding.styles.title': 'Bullet, blitz, rapid — pick your pace',
  'onboarding.styles.body': 'Three training styles, each with its own rating. Bullet rewards raw pattern recognition under tight time, blitz balances speed and depth, rapid is for deep calculation. Pick whichever matches the time-control you actually play.',
  'onboarding.calibration.title': 'First five sessions: calibration',
  'onboarding.calibration.body': 'Your starting rating is provisional. The first five sessions in each style let the system find your real level — your rating shows a "?" badge until calibration finishes. Manual rating selection is locked here so the result reflects your actual strength.',
  'onboarding.streak.title': 'Show up daily, drill what you missed',
  'onboarding.streak.body': 'A daily streak rewards consistency — one freeze a week covers a missed day, automatic. Failed or slow puzzles flow into Review, where you can drill them without time pressure. Achievements unlock for streaks, ratings, and exploring the app.',
  'onboarding.start.title': 'Pick a style and start',
  'onboarding.start.body': 'We\'ll drop you on the play screen — pick a style, choose a duration, and go. You can replay this walkthrough any time from Settings → App.',

  // Mobile-only.
  'onboarding.step': 'Step {n} of {total}',
};

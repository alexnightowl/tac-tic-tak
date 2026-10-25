// common area, en. Keys from the web dict (apps/frontend/src/lib/i18n.ts) keep
// their web text verbatim; mobile-only keys follow. Edit only your area's files.
import type { Dict } from '../types';

export const commonEn: Dict = {
  'home': 'Home',
  'play': 'Play',
  'review': 'Review',
  'stats': 'Stats',
  'settings': 'Settings',
  'leaderboard': 'Board',
  'logout': 'Log out',
  'nav.friends': 'Friends',

  'brand.tagline': 'Adaptive chess tactics trainer',

  'common.save': 'Save',
  'common.cancel': 'Cancel',

  'style.bullet.name': 'Bullet',
  'style.bullet.desc': 'Rapid-fire pattern recognition. Short sessions, snap decisions — trains the speed you need for bullet and hyper-bullet games.',
  'style.bullet.rating_label': 'Bullet rating',
  'style.blitz.name': 'Blitz',
  'style.blitz.desc': 'The all-rounder. Balanced pace and difficulty — the default choice for building tactical sharpness for blitz.',
  'style.blitz.rating_label': 'Blitz rating',
  'style.rapid.name': 'Rapid',
  'style.rapid.desc': 'Deep calculation. Longer sessions, tougher positions, higher accuracy bar — geared for rapid and classical play.',
  'style.rapid.rating_label': 'Rapid rating',

  'levels.novice': 'Novice',
  'levels.beginner': 'Beginner',
  'levels.intermediate': 'Intermediate',
  'levels.advanced': 'Advanced',
  'levels.expert': 'Expert',

  // Phase 2 mobile-only copy (was in local strings.ts tables).
  'ui.password_show': 'Show password',
  'ui.password_hide': 'Hide password',
  'ui.loading': 'Loading',
  'ui.on': 'On',
  'ui.off': 'Off',
  'nav.social': 'Social',
  'brand.name': 'tac·tic·tak',
  'dev.open': 'Dev menu',
};

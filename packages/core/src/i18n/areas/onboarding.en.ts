// onboarding area, en. The 4-step welcome (design v2 MobOnboarding1–4);
// the web's 5-slide copy was retired with it. Edit only your area's files.
import type { Dict } from '../types';

export const onboardingEn: Dict = {
  'onboarding.skip': 'Skip',
  'onboarding.step': 'Step {n} of {total}',
  'onboarding.begin': 'Begin',
  'onboarding.continue': 'Continue',
  'onboarding.find_level': 'Find my level',
  'onboarding.skip_start': 'Skip — start at {rating}',
  // Replayed by a player who already has a level (calibration done).
  'onboarding.recalibrate': 'Recalibrate my level',
  'onboarding.keep_level': 'Keep my level',
  'onboarding.recalibrate_note': 'Your next 5 sessions in each style will find your level again. Rating and history stay.',
  'onboarding.recalibrate_error': "Couldn't reach the server. Try again.",

  // 1 · Welcome (kicker = brand.name).
  'onboarding.welcome.title': 'See the strike\nbefore it lands',
  'onboarding.welcome.body': 'Short tactical sessions built around one idea — find the move that wins.',

  // 2 · The training (animated back-rank mate).
  'onboarding.training.kicker': 'The training',
  'onboarding.training.title': 'One move wins.\nFind it.',
  'onboarding.training.body': 'Every session is a run of puzzles matched to your level. Solve fast and clean — your rating follows.',
  'onboarding.training.board': 'Back-rank mate: rook d1 to d8',
  'onboarding.training.pill': 'Rd8# · solved in 4 s',

  // 3 · Your path (the rank eyes).
  'onboarding.path.kicker': 'Your path',
  'onboarding.path.title': 'Every level\nawakens a new eye',
  'onboarding.path.body': 'Climb from Novice to Expert. Your rank follows your rating — and it can slip if you stop sharpening.',
  'onboarding.path.you': '{level} · you',

  // 4 · The habit (sample streak card; illustrative values).
  'onboarding.habit.kicker': 'The habit',
  'onboarding.habit.title': 'A few minutes a day',
  'onboarding.habit.body': 'Keep the flame alive — one freeze a week covers a missed day.',
  'onboarding.habit.days': '4',
  'onboarding.habit.unit': 'day streak',
  'onboarding.habit.best': 'Best: 12 days',
  'onboarding.habit.weekdays': 'M,T,W,T,F,S,S',
  'onboarding.habit.freeze_note': 'Wednesday was covered by your weekly freeze',
  'onboarding.habit.review_title': 'Missed puzzles come back',
  'onboarding.habit.review_body': 'Drill them in Review until they stick',
  'onboarding.habit.review_count': '3',
};

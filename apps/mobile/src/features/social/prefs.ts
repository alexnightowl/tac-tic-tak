import type { TrainingStyle } from '@tac/core/rules';

import { appKV } from '@/platform/storage';
import type { LeaderboardScope } from './api';

// Device prefs (PLAN §2.4 devicePrefs): the last leaderboard style and scope.
const STYLE = 'taktic.leaderboardStyle';
const SCOPE = 'taktic.leaderboardScope';

export function readBoardStyle(): TrainingStyle {
  const v = appKV.getString(STYLE);
  return v === 'bullet' || v === 'rapid' || v === 'blitz' ? v : 'blitz';
}
export function writeBoardStyle(s: TrainingStyle): void {
  appKV.set(STYLE, s);
}
export function readBoardScope(): LeaderboardScope {
  return appKV.getString(SCOPE) === 'friends' ? 'friends' : 'global';
}
export function writeBoardScope(s: LeaderboardScope): void {
  appKV.set(SCOPE, s);
}

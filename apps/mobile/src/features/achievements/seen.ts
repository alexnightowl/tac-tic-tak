import { appKV, readJSON, writeJSON } from '@/platform/storage';

// Achievement slugs the player has already seen unlocked, per account and
// per device (PLAN §2.4 devicePrefs.seenAchievements). Drives the grid's
// shimmer on unlocks that happened since the last visit.

const key = (userId: string) => `taktic.seenAchievements.${userId}`;

/** null on the first visit ever (nothing to compare against). */
export function readSeen(userId: string): Set<string> | null {
  if (!userId || !appKV.contains(key(userId))) return null;
  return new Set(readJSON<string[]>(appKV, key(userId), []));
}

export function writeSeen(userId: string, slugs: Iterable<string>): void {
  if (!userId) return;
  writeJSON(appKV, key(userId), [...new Set(slugs)]);
}

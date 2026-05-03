/**
 * Single source of truth for the creator/founder nickname list.
 * Hardcoded on purpose — there's exactly one of them and the value
 * is part of the deploy. Both Avatar (for the ring + crown overlay)
 * and UserBadges (for the inline mark) read from here.
 *
 * To recognise a fellow founder, append to the set and ship.
 */
export const CREATOR_NICKNAMES = new Set<string>(['lazynightowl']);

export function isCreatorNickname(nickname: string | undefined | null): boolean {
  if (!nickname) return false;
  return CREATOR_NICKNAMES.has(nickname.toLowerCase());
}

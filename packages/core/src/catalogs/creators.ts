// From apps/frontend/src/lib/creators.ts. Hardcoded on purpose: there is
// one founder and the value ships with the build. Avatar (ring + crown)
// and UserBadges (inline mark) read it.

export const CREATOR_NICKNAMES = new Set<string>(['lazynightowl']);

export function isCreatorNickname(nickname: string | undefined | null): boolean {
  if (!nickname) return false;
  return CREATOR_NICKNAMES.has(nickname.toLowerCase());
}

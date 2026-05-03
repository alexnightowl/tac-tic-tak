'use client';

import { BadgeCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Hard-coded list of nicknames that get the gold creator badge.
 * No backend / DB plumbing on purpose — there's exactly one creator
 * and the value is part of the deploy. To add a fellow founder,
 * append to this array and ship.
 */
const CREATOR_NICKNAMES = new Set<string>(['lazynightowl']);

type Props = {
  nickname: string;
  /** Server-set verified flag from User.verified. The operator
   *  flips this on directly in the DB for accounts they want
   *  recognised. */
  verified?: boolean;
  size?: number;
  className?: string;
};

/**
 * Inline badges that go next to a nickname. Two distinct marks:
 *
 *   - Creator (hardcoded, gold sparkles): only the founder. Reads
 *     as "this is the person who built it" — distinct from generic
 *     verification so the creator never blends into the verified
 *     pool.
 *
 *   - Verified (DB-driven, sky-blue check): Twitter-style verified
 *     mark for accounts the operator recognises manually. No admin
 *     UI on purpose — flipped via DB.
 *
 * Both render side-by-side when applicable. Use this anywhere a
 * nickname is displayed (profile, leaderboard, friends, search,
 * dashboard welcome) so the visual stays consistent.
 */
export function UserBadges({ nickname, verified, size = 14, className }: Props) {
  const isCreator = CREATOR_NICKNAMES.has(nickname.toLowerCase());
  if (!isCreator && !verified) return null;
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 shrink-0 align-middle', className)}
    >
      {isCreator && (
        <Sparkles
          size={size}
          className="text-amber-300"
          aria-label="Creator"
          fill="currentColor"
        />
      )}
      {verified && (
        <BadgeCheck
          size={size}
          className="text-sky-400"
          aria-label="Verified"
        />
      )}
    </span>
  );
}

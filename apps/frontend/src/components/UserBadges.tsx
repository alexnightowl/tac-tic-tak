'use client';

import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  /** Server-set verified flag from User.verified. The operator
   *  flips this on directly in the DB for accounts they want
   *  recognised. */
  verified?: boolean;
  size?: number;
  className?: string;
};

/**
 * Twitter-style verified checkmark next to a user's nickname.
 * Distinct from the creator decoration that lives on the Avatar
 * (gold ring + Crown overlay) — these are two orthogonal markers
 * and the creator can have both.
 */
export function UserBadges({ verified, size = 14, className }: Props) {
  if (!verified) return null;
  return (
    <BadgeCheck
      size={size}
      className={cn('text-sky-400 shrink-0 align-middle', className)}
      aria-label="Verified"
    />
  );
}

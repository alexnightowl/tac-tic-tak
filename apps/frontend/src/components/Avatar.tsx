'use client';

import { Crown } from 'lucide-react';
import { assetUrl } from '@/lib/api';
import { isCreatorNickname } from '@/lib/creators';
import { cn } from '@/lib/utils';

type Props = {
  nickname: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
};

const BG_COLORS = [
  'bg-rose-500/30 text-rose-200',
  'bg-amber-500/30 text-amber-200',
  'bg-emerald-500/30 text-emerald-200',
  'bg-sky-500/30 text-sky-200',
  'bg-violet-500/30 text-violet-200',
  'bg-pink-500/30 text-pink-200',
  'bg-teal-500/30 text-teal-200',
];

/**
 * Avatar with optional creator decoration. The decoration auto-
 * applies when the nickname matches the hardcoded creator list
 * (lib/creators.ts), so every screen that renders an Avatar
 * (profile, leaderboard, friends, search, sessions) gets the
 * crown without each call site opting in.
 *
 * Decoration:
 *   - 2px amber ring with a 2px gap (via outline / outline-offset
 *     so it sits OUTSIDE the avatar without changing layout).
 *   - Small Crown chip in the bottom-right corner; size scales
 *     with the avatar but never drops below 12px so the icon
 *     stays legible on tiny rows.
 */
export function Avatar({ nickname, avatarUrl, size = 40, className }: Props) {
  const resolved = assetUrl(avatarUrl);
  const initials = getInitials(nickname);
  const color = BG_COLORS[hashString(nickname) % BG_COLORS.length];
  const isCreator = isCreatorNickname(nickname);

  // Inner avatar — img if uploaded, otherwise a coloured initials
  // chip. Border / outline applied here directly so the decoration
  // sits flush against the circle.
  const innerClasses = cn(
    'w-full h-full rounded-full flex items-center justify-center font-semibold object-cover',
    isCreator
      ? 'outline outline-2 outline-amber-300 outline-offset-[2px]'
      : 'border border-white/10',
  );

  // Wrapper preserves the original `size × size` footprint so
  // callers passing className for layout (mr-3, etc) keep working.
  return (
    <div
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {resolved ? (
        <img
          src={resolved}
          alt={nickname}
          width={size}
          height={size}
          className={innerClasses}
        />
      ) : (
        <div
          className={cn(innerClasses, color)}
          style={{ fontSize: Math.round(size * 0.42) }}
          aria-label={nickname}
        >
          {initials}
        </div>
      )}
      {isCreator && <CreatorCrown size={size} />}
    </div>
  );
}

function CreatorCrown({ size }: { size: number }) {
  // 32% of avatar but minimum 14px so the crown is recognisable
  // even on the small leaderboard rows.
  const chip = Math.max(14, Math.round(size * 0.32));
  const icon = Math.max(9, Math.round(chip * 0.6));
  return (
    <div
      className="absolute rounded-full flex items-center justify-center shadow-md ring-2 ring-[var(--bg-base)]"
      style={{
        width: chip,
        height: chip,
        bottom: -Math.round(chip * 0.15),
        right: -Math.round(chip * 0.15),
        background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 60%, #d97706 100%)',
      }}
      aria-label="Creator"
      title="Creator"
    >
      <Crown size={icon} className="text-amber-950" fill="currentColor" />
    </div>
  );
}

function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/[^A-Za-zА-Яа-яЁё0-9]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h);
}

'use client';

import { assetUrl } from '@/lib/api';
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

export function Avatar({ nickname, avatarUrl, size = 40, className }: Props) {
  const resolved = assetUrl(avatarUrl);
  const initials = getInitials(nickname);
  const color = BG_COLORS[hashString(nickname) % BG_COLORS.length];

  const style: React.CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  if (resolved) {
    return (
      <img
        src={resolved}
        alt={nickname}
        width={size}
        height={size}
        style={style}
        className={cn('rounded-full object-cover border border-white/10', className)}
      />
    );
  }
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold border border-white/10',
        color, className,
      )}
      style={style}
      aria-label={nickname}
    >
      {initials}
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

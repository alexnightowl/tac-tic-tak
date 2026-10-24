'use client';

import { BarChart3, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Themed tab-bar glyphs (Ember on stone).
 *  - Home    → clan crest, keeps its own colours (dimmed when inactive)
 *  - Play    → hand seal, mask-tinted with currentColor
 *  - Review  → open book, mask-tinted with currentColor
 *  - Board/Leaderboard, Stats → line icons
 *  - Settings → shuriken
 */
type IconProps = { active?: boolean; className?: string };

function Mask({ src, w, h, className }: { src: string; w: number; h: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block shrink-0 bg-current', className)}
      style={{
        width: w,
        height: h,
        WebkitMask: `url(${src}) center / contain no-repeat`,
        mask: `url(${src}) center / contain no-repeat`,
      }}
    />
  );
}

export function HomeIcon({ active, className }: IconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/design/icons/nav-home.png"
      alt=""
      aria-hidden
      width={24}
      height={24}
      draggable={false}
      className={cn('block shrink-0 transition-[opacity,filter]', !active && 'opacity-50 saturate-[0.55]', className)}
      style={{ width: 24, height: 24 }}
    />
  );
}

export function PlayIcon({ className }: IconProps) {
  return <Mask src="/design/icons/nav-play.png" w={24} h={24} className={className} />;
}

export function ReviewIcon({ className }: IconProps) {
  return <Mask src="/design/icons/nav-review-book.svg" w={28} h={24} className={className} />;
}

export function LeaderboardIcon({ active, className }: IconProps) {
  return <Trophy size={21} strokeWidth={active ? 2 : 1.8} className={className} />;
}

export function StatsIcon({ active, className }: IconProps) {
  return <BarChart3 size={21} strokeWidth={active ? 2 : 1.8} className={className} />;
}

export function ShurikenIcon({ className, size = 23 }: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M9.30 9.30 Q9.60 4.60 15.20 1.90 Q13.40 6.20 14.70 9.30 Q19.40 9.60 22.10 15.20 Q17.80 13.40 14.70 14.70 Q14.40 19.40 8.80 22.10 Q10.60 17.80 9.30 14.70 Q4.60 14.40 1.90 8.80 Q6.20 10.60 9.30 9.30Z" />
      <circle cx="12" cy="12" r="1.9" />
    </svg>
  );
}

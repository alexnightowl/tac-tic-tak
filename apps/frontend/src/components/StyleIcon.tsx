'use client';

import { Rocket, Zap, Timer, type LucideIcon } from 'lucide-react';
import type { TrainingStyle } from '@/lib/levels';
import { cn } from '@/lib/utils';

/**
 * Time-control glyphs lifted from chess.com's familiar shorthand:
 *   - Bullet → rocket (small, fast)
 *   - Blitz  → lightning bolt
 *   - Rapid  → stopwatch
 *
 * Picking distinct shapes is more important than literally copying
 * chess.com's bitmaps; the lucide set above gets you the same
 * mental model in two glances.
 */
export const STYLE_ICONS: Record<TrainingStyle, LucideIcon> = {
  bullet: Rocket,
  blitz: Zap,
  rapid: Timer,
};

/**
 * Per-style accent colours. Echo chess.com's amber/yellow/green
 * palette so scrolling a session list reads the time control at a
 * glance. Bullet leans orange specifically to read clearly next to
 * blitz's yellow — they're easy to confuse otherwise.
 */
export const STYLE_COLORS: Record<TrainingStyle, string> = {
  bullet: 'text-orange-400',
  blitz: 'text-yellow-400',
  rapid: 'text-emerald-400',
};

type Props = {
  style: TrainingStyle;
  size?: number;
  className?: string;
  /** When false, drops the per-style colour so the icon inherits
   *  the surrounding context (e.g. var(--accent) on a feature card
   *  where the colour is already meaningful). */
  colored?: boolean;
};

export function StyleIcon({ style, size = 14, className, colored = true }: Props) {
  const Icon = STYLE_ICONS[style];
  return (
    <Icon
      size={size}
      className={cn(colored && STYLE_COLORS[style], className)}
    />
  );
}

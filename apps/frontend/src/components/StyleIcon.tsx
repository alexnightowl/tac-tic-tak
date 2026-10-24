'use client';

import type { TrainingStyle } from '@/lib/levels';
import { cn } from '@/lib/utils';

/**
 * Time-control glyphs: rapid → hourglass, blitz → lightning, bullet → kunai.
 * Single-colour masks filled with `currentColor`, so they follow the text
 * colour of whatever they sit in (grey on idle tabs, light on the active one).
 */
export const STYLE_ICON_SRC: Record<TrainingStyle, string> = {
  rapid: '/design/icons/mode-rapid.png',
  blitz: '/design/icons/mode-blitz.png',
  bullet: '/design/icons/mode-bullet.png',
};

/** Order for every picker / list: slowest → fastest. */
export const STYLE_ORDER: TrainingStyle[] = ['rapid', 'blitz', 'bullet'];

/** Kept for callers that colour text by style; all neutral now. */
export const STYLE_COLORS: Record<TrainingStyle, string> = {
  bullet: 'text-eos-bone',
  blitz: 'text-eos-bone',
  rapid: 'text-eos-bone',
};

type Props = {
  style: TrainingStyle;
  size?: number;
  className?: string;
  colored?: boolean;
};

export function StyleIcon({ style, size = 14, className }: Props) {
  const url = `url(${STYLE_ICON_SRC[style]})`;
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0 bg-current', className)}
      style={{
        width: size,
        height: size,
        WebkitMask: `${url} center / contain no-repeat`,
        mask: `${url} center / contain no-repeat`,
      }}
    />
  );
}

'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

type Props = {
  size?: number;
  withWordmark?: boolean;
  /** On light backgrounds (e.g. the landing hero) we serve the dark logo;
   *  on dark backgrounds (e.g. the app nav) we serve the light variant. */
  tone?: 'dark' | 'light';
  className?: string;
};

/**
 * Tacticore brand mark — a stylised knight / horse head with sharingan-red
 * eyes inside an enso brush-stroke ring. The PNG assets live in
 * `public/brand/` and render at any size via `next/image`.
 */
export function Logo({ size = 36, withWordmark = false, tone = 'dark', className }: Props) {
  // `tone` describes the SURFACE the mark sits on, not the mark itself.
  // A dark surface needs the light logo variant and vice-versa.
  const src = tone === 'light' ? '/brand/logo.png' : '/brand/logo-light.png';

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <Image
        src={src}
        alt="tac·tic·tak"
        width={size}
        height={size}
        priority={size >= 96}
        className="block select-none rounded-full"
        style={{ width: size, height: size }}
        draggable={false}
      />
      {withWordmark && (
        <span
          className={cn(
            'font-display font-bold tracking-tight',
            tone === 'light' ? 'text-[#121212]' : 'text-white',
          )}
          style={{ fontSize: Math.round(size * 0.48) }}
        >
          tac<span className="text-[var(--accent)]">·</span>tic<span className="text-[var(--accent)]">·</span>tak
        </span>
      )}
    </div>
  );
}

'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

type Props = {
  size?: number;
  withWordmark?: boolean;
  /** Surface the mark sits on. Landing (light paper) keeps the old ring
   *  mark; everything dark uses the cut-out sharingan knight. */
  tone?: 'dark' | 'light';
  /** Soft ember glow behind the knight (Ember on stone). */
  glow?: boolean;
  className?: string;
};

/**
 * Brand mark — knight head with sharingan eyes. On dark surfaces it is
 * the transparent cut-out from the redesign (`/design/knight-logo.webp`),
 * optionally with a diffuse ember glow behind it.
 */
export function Logo({ size = 36, withWordmark = false, tone = 'dark', glow = false, className }: Props) {
  const src = tone === 'light' ? '/brand/logo.png' : '/design/knight-logo.webp';

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        {glow && tone === 'dark' && (
          <span
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              left: -size * 0.9,
              top: -size * 0.9,
              width: size * 2.8,
              height: size * 2.8,
              background:
                'radial-gradient(circle at 50% 46%, rgba(201,81,70,0.42) 0%, rgba(166,66,65,0.26) 18%, rgba(133,48,49,0.14) 36%, rgba(96,35,39,0.06) 54%, rgba(29,27,32,0) 72%)',
              filter: `blur(${Math.max(4, Math.round(size * 0.11))}px)`,
            }}
          />
        )}
        <Image
          src={src}
          alt="tac·tic·tak"
          width={size}
          height={size}
          priority={size >= 96}
          className={cn('relative block select-none', tone === 'light' && 'rounded-full')}
          style={{ width: size, height: size, filter: tone === 'dark' && size >= 64 ? 'drop-shadow(0 8px 14px rgba(17,15,17,0.55))' : undefined }}
          draggable={false}
        />
      </span>
      {withWordmark && (
        <span
          className={cn(
            tone === 'light' ? 'font-display font-bold tracking-tight text-[#1c1b1d]' : 'font-serif font-bold tracking-[0.04em] text-eos-bone',
          )}
          style={{ fontSize: Math.round(size * (tone === 'light' ? 0.48 : 0.6)) }}
        >
          tac·tic·tak
        </span>
      )}
    </div>
  );
}

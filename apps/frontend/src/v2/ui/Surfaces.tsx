import { layout, radii } from '@tac/core/tokens';
import clsx from 'clsx';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { AppText } from './AppText';
import './kit.css';

type SurfaceProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode; testID?: string };

/**
 * `.card`: flat slate, 1 px bone/4 % border, inset top highlight + soft
 * drop (`0 12px 28px -14px`). Padding 16 by default (the design uses 12 for
 * compact tiles); radius 12 (16 for list cards, see CardRow).
 */
export function Card({
  className,
  style,
  padding = layout.cardPadding,
  radius = radii.cardComponent,
  testID,
  ...rest
}: SurfaceProps & { padding?: number; radius?: number }) {
  return (
    <div
      {...rest}
      data-testid={testID}
      className={clsx('v2-card', className)}
      style={{ padding, borderRadius: radius, ...style }}
    />
  );
}

/**
 * `.tx-slate` hero card: the seamless slate texture tiled under a vertical
 * veil (0.74 → 0.86), inset 1 px bone/6 % ring, `0 14px 30px` drop.
 * Radius 12, padding 20.
 */
export function HeroCard({ className, testID, ...rest }: SurfaceProps) {
  return <div {...rest} data-testid={testID} className={clsx('v2-hero', className)} />;
}

export type WellTone = 'carved' | 'soft';

/**
 * `.well`: carved inset. `carved` (default) = `inset 0 2px 4px` (inputs,
 * segmented tracks on the page); `soft` = `inset 0 2px 3px` + a 1 px
 * bone/3 % inner ring, the variant used inside a grouped list.
 */
export function Well({ className, tone = 'carved', testID, ...rest }: SurfaceProps & { tone?: WellTone }) {
  return (
    <div {...rest} data-testid={testID} className={clsx('v2-well', tone === 'soft' && 'v2-well--soft', className)} />
  );
}

/**
 * `.float`: chrome that floats over a board or hero (runner counters,
 * TurnCard, viewer pills): shade at 92 %, 1 px bone/5 % border (`subtle`:
 * 4 %). Radius 16 by default; pass `radius={radii.full}` for pills.
 */
export function Float({
  className,
  style,
  radius = radii['2xl'],
  subtle = false,
  testID,
  ...rest
}: SurfaceProps & { radius?: number; subtle?: boolean }) {
  return (
    <div
      {...rest}
      data-testid={testID}
      className={clsx('v2-float', subtle && 'v2-float--subtle', className)}
      style={{ borderRadius: radius, ...style }}
    />
  );
}

export type NoteTone = 'neutral' | 'ember' | 'emberSoft' | 'gold';

const NOTE_CLASS: Record<NoteTone, string> = {
  neutral: 'v2-note--neutral',
  ember: 'v2-note--ember',
  emberSoft: 'v2-note--ember-soft',
  gold: 'v2-note--gold',
};

/**
 * `.note` callout (Summary, Home resume card): radius 16, 1 px border,
 * padding 16, title 14/20 bold + body 12/16 ash. With `icon` the note lays
 * out in a row (icon, then the text column), gap 12. `glow` adds the gold
 * halo of the unlock note.
 */
export function Note({
  tone = 'neutral',
  title,
  body,
  icon,
  glow = false,
  children,
  className,
  style,
  testID,
}: {
  tone?: NoteTone;
  title?: string;
  body?: string;
  icon?: ReactNode;
  glow?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  testID?: string;
}) {
  const text =
    title || body ? (
      <div className="v2-note-text">
        {title ? (
          <AppText variant="bodyStrong" color="var(--note-title)">
            {title}
          </AppText>
        ) : null}
        {body ? <AppText variant="caption">{body}</AppText> : null}
      </div>
    ) : null;
  return (
    <div
      data-testid={testID}
      className={clsx('v2-note', NOTE_CLASS[tone], icon && 'v2-note--row', glow && 'v2-note--glow', className)}
      style={style}
    >
      {icon}
      {text}
      {children}
    </div>
  );
}

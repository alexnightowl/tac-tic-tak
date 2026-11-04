'use client';

import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { AppText, type TextVariantName } from './AppText';
import { Press } from './Press';
import './kit.css';

/**
 * List card (Review themes, "Session history", Home recent sessions): slate
 * card, radius 16, padding 12, gap 12 — leading tile, a title (serif 15,
 * `turnTitle`) over a 12/16 ash subtitle, then trailing content and an
 * 18 px dust chevron. `elevated` (default) adds the `.card` shadow; Home's
 * session rows are flat.
 */
export function CardRow({
  title,
  subtitle,
  titleVariant = 'turnTitle',
  leading,
  trailing,
  children,
  onPress,
  href,
  chevron,
  elevated = true,
  testID,
  accessibilityLabel,
  className,
  style,
}: {
  title?: string;
  subtitle?: string | null;
  titleVariant?: TextVariantName;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Replaces the title/subtitle column (custom middle content). */
  children?: ReactNode;
  onPress?: () => void;
  /** Navigate instead of onPress (renders a link). */
  href?: string;
  /** Defaults to true when pressable. */
  chevron?: boolean;
  elevated?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const pressable = !!onPress || !!href;
  const body = (
    <>
      {pressable ? <span className="v2-press-overlay" /> : null}
      {leading}
      {children ?? (
        <span className="v2-col">
          {title ? (
            <AppText variant={titleVariant} numberOfLines={1}>
              {title}
            </AppText>
          ) : null}
          {subtitle ? (
            <AppText variant="caption" numberOfLines={2} className="v2-tabular">
              {subtitle}
            </AppText>
          ) : null}
        </span>
      )}
      {trailing}
      {(chevron ?? pressable) ? <ChevronRight size={18} strokeWidth={2} className="v2-chev" aria-hidden /> : null}
    </>
  );
  const cls = clsx('v2-cardrow', elevated && 'v2-cardrow--elevated', className);
  if (!pressable) {
    return (
      <div className={cls} style={style} data-testid={testID}>
        {body}
      </div>
    );
  }
  return (
    <Press
      testID={testID}
      onPress={onPress}
      href={href}
      aria-label={accessibilityLabel}
      className={clsx(cls, 'v2-pressable')}
      style={style}
    >
      {body}
    </Press>
  );
}

/**
 * Empty state (Review "No puzzles in review"): padding 40/16, centred,
 * gap 12 — a 56 px card disc with the glyph, a serif 22/28 title, a 14/20
 * ash body, then optional actions.
 */
export function EmptyState({
  icon,
  title,
  body,
  children,
  testID,
  className,
  style,
}: {
  icon?: ReactNode;
  title: string;
  body?: string | null;
  children?: ReactNode;
  testID?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={clsx('v2-empty', className)} style={style} data-testid={testID}>
      {icon ? <div className="v2-empty-disc v2-card">{icon}</div> : null}
      <AppText as="h2" variant="title">
        {title}
      </AppText>
      {body ? (
        <AppText as="p" variant="body" color="var(--eos-ash)">
          {body}
        </AppText>
      ) : null}
      {children}
    </div>
  );
}

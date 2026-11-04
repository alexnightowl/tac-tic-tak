import { space } from '@tac/core/tokens';
import clsx from 'clsx';
import type { CSSProperties, ElementType, ReactNode } from 'react';

import { AppText } from './AppText';
import './kit.css';

export type SectionLabelSize = 'group' | 'section';

/**
 * Uppercase section labels, ash, as a heading.
 *  - `group` (default) = `.sect` / `.lbl`: 11 px 700, 1.32 px tracking,
 *    4 px side inset (sits above a GroupedList).
 *  - `section` = `.sec` / `.slbl`: 12 px 700, 1.44 px tracking, no inset
 *    (Stats / Profile / Home section heads).
 */
export function SectionLabel({
  children,
  size = 'group',
  color,
  inset,
  as = 'h2',
  className,
  style,
  testID,
}: {
  children: ReactNode;
  size?: SectionLabelSize;
  color?: string;
  /** Side inset; defaults to 4 for `group`, 0 for `section`. */
  inset?: number;
  /** Heading level (default h2). */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  testID?: string;
}) {
  const pad = inset ?? (size === 'group' ? space[1] : 0);
  return (
    <AppText
      as={as}
      variant={size === 'group' ? 'label' : 'sectionLabel'}
      color={color}
      className={className}
      style={{ ...(pad ? { paddingLeft: pad, paddingRight: pad } : null), ...style }}
      testID={testID}
    >
      {children}
    </AppText>
  );
}

/** `.kick`: 12 px 700 caps, 2 px tracking, rose (onboarding kickers). */
export function Kicker({
  children,
  color,
  className,
  style,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <AppText variant="kicker" color={color} className={className} style={style}>
      {children}
    </AppText>
  );
}

/**
 * Tab-page title block (Review / Stats): serif 22/28 h1 and an optional
 * 14/20 ash lede, gap 6, padded 16 top and bottom.
 */
export function PageTitle({
  title,
  subtitle,
  children,
  className,
  style,
  testID,
}: {
  title: string;
  subtitle?: string | null;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  testID?: string;
}) {
  return (
    <div className={clsx('v2-pagetitle', className)} style={style} data-testid={testID}>
      <AppText as="h1" variant="title">
        {title}
      </AppText>
      {subtitle ? (
        <AppText as="p" variant="body" color="var(--eos-ash)">
          {subtitle}
        </AppText>
      ) : null}
      {children}
    </div>
  );
}

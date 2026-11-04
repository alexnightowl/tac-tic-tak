'use client';

import { layout } from '@tac/core/tokens';
import clsx from 'clsx';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Children, Fragment, isValidElement, useId, type CSSProperties, type ReactNode } from 'react';

import { AppText, type TextVariantName } from './AppText';
import { Press } from './Press';
import { SectionLabel } from './SectionLabel';
import { Toggle } from './Toggle';
import './kit.css';

// Grouped lists of the design v2 settings / about / account artboards:
// `.grp` (slate group, radius 12), `.seam` (1 px ink rule inset 16),
// `.row` (52 px row: icon · label + hint · value · chevron), `.blk`
// (label + hint above a full-width control) and the `.sect` section label.

/** `.seam`: 1 px ink rule, inset 16 from the left. */
export function Seam({ inset = layout.seamInset }: { inset?: number }) {
  return <div className="v2-seam" style={{ marginLeft: inset }} role="presentation" />;
}

/**
 * `.grp`: slate group, radius 12, 1 px bone/4 % border, clipped. Children
 * are separated by a Seam unless `seams={false}` (null children are skipped).
 */
export function GroupedList({
  children,
  seams = true,
  className,
  style,
  testID,
}: {
  children: ReactNode;
  seams?: boolean;
  className?: string;
  style?: CSSProperties;
  testID?: string;
}) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <div className={clsx('v2-group', className)} style={style} data-testid={testID}>
      {seams
        ? items.map((child, i) => (
            <Fragment key={child.key ?? i}>
              {i > 0 ? <Seam /> : null}
              {child}
            </Fragment>
          ))
        : items}
    </div>
  );
}

/**
 * A titled group: `.sect` label (11 px caps, ash, 4 px side inset), the
 * group, and an optional footer hint (12/16 ash). Gap 8.
 */
export function ListSection({
  title,
  footer,
  children,
  testID,
  className,
  style,
}: {
  title?: string;
  footer?: string | null;
  children: ReactNode;
  testID?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={clsx('v2-section', className)} style={style} data-testid={testID}>
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <GroupedList>{children}</GroupedList>
      {footer ? (
        <AppText as="p" variant="caption" style={{ padding: '0 4px' }}>
          {footer}
        </AppText>
      ) : null}
    </section>
  );
}

export type RowProps = {
  label: string;
  hint?: string | null;
  /** Right-aligned value in ash (e.g. "20:00", "0.1.0"). */
  value?: string | null;
  /** 20 px line icon in ash (rose-red when `danger`), stroke 1.8. */
  icon?: LucideIcon;
  /** Custom leading node (avatar, IconTile); replaces `icon`. */
  leading?: ReactNode;
  /** Custom trailing node (Toggle, MiniButton); shown before the chevron. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Navigate instead of onPress (renders a link). */
  href?: string;
  /** Defaults to true for a pressable, non-danger row. */
  chevron?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Padding override (the profile row uses 16 all round). */
  padding?: number;
  /** Label style (the profile row uses `title`). */
  labelVariant?: TextVariantName;
  /** Lines of hint before ellipsis (default: unlimited). */
  hintLines?: number;
  /** Id for the label element (a trailing control can point aria-labelledby at it). */
  labelId?: string;
  testID?: string;
  accessibilityLabel?: string;
};

/**
 * `.row`: min 52 px, padding 12/16, gap 12. Pressable rows (`onPress` or
 * `href`) are one button / link with a bone/5 % overlay while held.
 */
export function Row({
  label,
  hint,
  value,
  icon: Icon,
  leading,
  trailing,
  onPress,
  href,
  chevron,
  danger = false,
  disabled = false,
  padding,
  labelVariant = 'bodyLg',
  hintLines,
  labelId,
  testID,
  accessibilityLabel,
}: RowProps) {
  const pressable = !!onPress || !!href;
  const showChevron = chevron ?? (pressable && !danger);
  const body = (
    <>
      {pressable ? <span className="v2-press-overlay" /> : null}
      {leading ??
        (Icon ? (
          <Icon
            size={20}
            strokeWidth={1.8}
            color={danger ? 'var(--tone-danger)' : 'var(--eos-ash)'}
            style={{ flex: 'none' }}
            aria-hidden
          />
        ) : null)}
      <span className="v2-col">
        <AppText id={labelId} variant={labelVariant} color={danger ? 'var(--tone-danger)' : undefined}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" numberOfLines={hintLines}>
            {hint}
          </AppText>
        ) : null}
      </span>
      {value ? (
        <AppText variant="bodyLg" color="var(--eos-ash)" numberOfLines={1} className="v2-row-value">
          {value}
        </AppText>
      ) : null}
      {trailing}
      {showChevron ? <ChevronRight size={18} strokeWidth={2} className="v2-chev" aria-hidden /> : null}
    </>
  );
  const style = padding != null ? { padding } : undefined;
  if (!pressable) {
    return (
      <div className={clsx('v2-row', disabled && 'v2-row--disabled')} style={style} data-testid={testID}>
        {body}
      </div>
    );
  }
  return (
    <Press
      testID={testID}
      onPress={onPress}
      href={href}
      disabled={disabled}
      aria-label={accessibilityLabel}
      className={clsx('v2-row v2-pressable v2-focus-in', disabled && 'v2-row--disabled')}
      style={style}
    >
      {body}
    </Press>
  );
}

/** `.row` with the `.tg` switch on the right (label + hint, no chevron). */
export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  testID,
  disabled,
}: {
  label: string;
  hint?: string | null;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <Row
      label={label}
      hint={hint}
      labelId={id}
      trailing={
        <Toggle
          value={value}
          onChange={onChange}
          testID={testID}
          accessibilityLabel={label}
          labelledBy={id}
          disabled={disabled}
        />
      }
    />
  );
}

/**
 * `.blk`: padding 14/16, column, gap 12 — a label (16/24) and hint above a
 * full-width control (Segmented, board preview, piece-set picker).
 */
export function ControlBlock({
  label,
  hint,
  children,
  testID,
  className,
  style,
}: {
  label?: string;
  hint?: string | null;
  children: ReactNode;
  testID?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={clsx('v2-block', className)} style={style} data-testid={testID}>
      {label ? (
        <div className="v2-col">
          <AppText variant="bodyLg">{label}</AppText>
          {hint ? <AppText variant="caption">{hint}</AppText> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** About's key/value line: min 48 px, padding 0/16, body 14/20, value ash. */
export function InfoRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <div className="v2-info" data-testid={testID}>
      <AppText variant="body" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant="body" color="var(--eos-ash)">
        {value}
      </AppText>
    </div>
  );
}

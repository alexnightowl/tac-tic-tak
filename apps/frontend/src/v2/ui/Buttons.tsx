'use client';

import clsx from 'clsx';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { useT } from '@/lib/i18n';
import { AppText, type TextVariantName } from './AppText';
import { Press } from './Press';
import './kit.css';

// Small controls of the design v2 artboards that are not plates: `.mini`
// row actions, the danger outline button, `.chip` filters, round header /
// overlay buttons (`.back`, `.float`, `.glass`, `.link`, `.play`), `.pill`
// overlay buttons, the ember caps link and the count badge.

// --- spinner -----------------------------------------------------------------

/** The iOS-style 8-spoke activity indicator (the app's small ActivityIndicator). */
export function Spinner({ size = 20, color = 'currentColor', label }: { size?: number; color?: string; label?: string }) {
  return (
    <svg
      className="v2-spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={i}
          x1="12"
          y1="3"
          x2="12"
          y2="7.5"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity={0.25 + (i / 7) * 0.75}
          transform={`rotate(${i * 45} 12 12)`}
        />
      ))}
    </svg>
  );
}

/** Spinner sized for a button label (callers composing their own buttons). */
export function ButtonSpinner({ color = 'var(--eos-bone)' }: { color?: string }) {
  const t = useT();
  return <Spinner color={color} label={t('ui.loading')} />;
}

// --- MiniButton --------------------------------------------------------------

export type MiniVariant = 'ember' | 'ghost' | 'danger';

/**
 * `.mini` row action: 32 px, radius 8, padding 0/10, gap 4, 11 px caps
 * label. `ember` = ember fill / onEmber ink; `ghost` = 1 px seam border on
 * bone/5 %; `danger` = the Home "Discard" (36 px, ember/70 border, danger
 * ink). `iconOnly` squares it to 36 wide.
 */
export function MiniButton({
  label,
  icon: Icon,
  variant = 'ghost',
  onPress,
  href,
  busy = false,
  disabled = false,
  iconOnly = false,
  block = false,
  testID,
  accessibilityLabel,
  className,
  style,
}: {
  label: string;
  icon?: LucideIcon;
  variant?: MiniVariant;
  onPress?: () => void;
  href?: string;
  busy?: boolean;
  disabled?: boolean;
  iconOnly?: boolean;
  /** Stretch (flex: 1) inside a row. */
  block?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const t = useT();
  return (
    <Press
      testID={testID}
      onPress={onPress}
      href={href}
      disabled={disabled || busy}
      aria-label={accessibilityLabel ?? (iconOnly ? label : undefined)}
      aria-busy={busy || undefined}
      className={clsx(
        'v2-mini v2-dim',
        `v2-mini--${variant}`,
        iconOnly && 'v2-mini--icon',
        block && 'v2-mini--block',
        (disabled || busy) && 'v2-off',
        className,
      )}
      style={style}
    >
      {busy ? (
        <Spinner size={14} label={t('ui.loading')} />
      ) : Icon ? (
        <Icon size={14} strokeWidth={variant === 'ember' ? 2.4 : 2.2} aria-hidden />
      ) : null}
      {iconOnly ? null : (
        <AppText variant="label" color="currentColor" numberOfLines={1}>
          {label}
        </AppText>
      )}
    </Press>
  );
}

// --- DangerButton -------------------------------------------------------------

/**
 * Destructive outline button of the sheets: 44 px, radius 12, 1 px
 * ember/70 border, serif 14 caps in danger red; `filled` adds the ember/10
 * fill (Reset). `busy` dims to 0.6 and swaps the label for "…".
 */
export function DangerButton({
  label,
  onPress,
  filled = false,
  busy = false,
  disabled = false,
  testID,
  accessibilityLabel,
  className,
  style,
}: {
  label: string;
  onPress: () => void;
  filled?: boolean;
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Press
      testID={testID}
      onPress={onPress}
      disabled={disabled || busy}
      aria-label={accessibilityLabel ?? (busy ? label : undefined)}
      aria-busy={busy || undefined}
      className={clsx('v2-danger v2-dim', filled && 'v2-danger--filled', (busy || disabled) && 'v2-off', className)}
      style={style}
    >
      <AppText variant="plateLabel" color="currentColor" numberOfLines={1}>
        {busy ? '…' : label}
      </AppText>
    </Press>
  );
}

// --- Chip ----------------------------------------------------------------------

/**
 * `.chip` filter: 32 px pill, padding 0/12, 12.5 px bold; idle = slate with
 * a bone/5 % inset ring, ash ink; `selected` = bone fill, ink text.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  testID,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Press
      testID={testID}
      onPress={onPress}
      aria-pressed={selected}
      aria-label={accessibilityLabel}
      className="v2-chip"
    >
      <AppText variant="chip" color="currentColor" numberOfLines={1}>
        {label}
      </AppText>
    </Press>
  );
}

// --- IconButton ---------------------------------------------------------------

export type IconButtonVariant = 'back' | 'float' | 'glass' | 'plain' | 'tile';

/**
 * Round (or square) icon-only button.
 *  - `back`  = `.back`: bone/6 % fill + 1 px bone/8 % inset ring (settings headers);
 *  - `float` = `.float`: shade/92 % + 1 px bone/5 % border (over boards; 44 or 48);
 *  - `glass` = `.glass`: graphite/90 % + 1 px bone/8 % + `0 4px 12px` drop (over heroes);
 *  - `plain` = `.link` / `.eye`: transparent;
 *  - `tile`  = `.play`: 36 px square, radius 6, rise fill (sound preview).
 * The icon is the caller's node (size it 20–22 px; it inherits bone).
 */
export function IconButton({
  variant = 'float',
  size,
  icon,
  onPress,
  href,
  disabled = false,
  testID,
  accessibilityLabel,
  className,
  style,
}: {
  variant?: IconButtonVariant;
  /** Defaults: 36 for `tile`, else 44. */
  size?: number;
  icon: ReactNode;
  onPress?: () => void;
  href?: string;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel: string;
  className?: string;
  style?: CSSProperties;
}) {
  const s = size ?? (variant === 'tile' ? 36 : 44);
  return (
    <Press
      testID={testID}
      onPress={onPress}
      href={href}
      disabled={disabled}
      aria-label={accessibilityLabel}
      title={accessibilityLabel}
      className={clsx('v2-iconbtn v2-dim', `v2-iconbtn--${variant}`, disabled && 'v2-off', className)}
      style={{ width: s, height: s, ...style }}
    >
      {icon}
    </Press>
  );
}

// --- PillButton ---------------------------------------------------------------

/**
 * `.float.pill` overlay button (viewer / drill / runner): 44 px pill
 * (`height={40}` for the runner's `.glass`), padding 0/16 (0/12 at 40),
 * gap 8 (6 at 40), a 16 px icon (18 at 40) and an 11 px caps label in bone.
 * `status` renders the non-pressable sage "Solved!" pill.
 */
export function PillButton({
  label,
  icon,
  onPress,
  href,
  height = 44,
  status = false,
  minWidth,
  disabled = false,
  labelVariant = 'label',
  children,
  testID,
  accessibilityLabel,
  className,
  style,
}: {
  label?: string;
  icon?: ReactNode;
  onPress?: () => void;
  href?: string;
  height?: 40 | 44;
  status?: boolean;
  minWidth?: number;
  disabled?: boolean;
  /** Label style: `label` (11 px caps, default) or e.g. `caption` (viewer's "1212 · Lichess"). */
  labelVariant?: TextVariantName;
  /** Extra trailing content (hint dots). */
  children?: ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  className?: string;
  /** The pill itself (the app's contentStyle). */
  style?: CSSProperties;
}) {
  const small = height === 40;
  const cls = clsx(
    'v2-pill',
    status ? 'v2-pill--status' : 'v2-pill--float',
    minWidth ? 'v2-pill--center' : null,
    disabled && 'v2-off',
    className,
  );
  const box: CSSProperties = {
    height,
    padding: `0 ${small ? 12 : 16}px`,
    gap: small ? 6 : 8,
    minWidth,
    ...style,
  };
  const body = (
    <>
      {icon}
      {label ? (
        <AppText variant={labelVariant} color="currentColor" numberOfLines={1} className="v2-tabular">
          {label}
        </AppText>
      ) : null}
      {children}
    </>
  );
  if (status || (!onPress && !href)) {
    return (
      <div
        data-testid={testID}
        role={status ? 'status' : undefined}
        aria-label={accessibilityLabel}
        className={cls}
        style={box}
      >
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
      className={clsx(cls, 'v2-dim')}
      style={box}
    >
      {body}
    </Press>
  );
}

// --- TextLink -------------------------------------------------------------------

/**
 * Ember caps link with a trailing chevron (Home "All sessions"): 11 px 700
 * caps, gap 2, 32 px tall. An `<a>` with `href`, else a button.
 */
export function TextLink({
  label,
  onPress,
  href,
  chevron = true,
  color = 'var(--eos-ember)',
  testID,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  href?: string;
  chevron?: boolean;
  color?: string;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Press
      testID={testID}
      onPress={onPress}
      href={href}
      aria-label={accessibilityLabel}
      className="v2-link v2-dim"
      style={{ color }}
    >
      <AppText variant="label" color="currentColor" className="v2-link-label">
        {label}
      </AppText>
      {chevron ? <ChevronRight size={14} strokeWidth={2} aria-hidden /> : null}
    </Press>
  );
}

// --- CountBadge -------------------------------------------------------------------

/**
 * Ember count bubble (header avatar, friend requests): 18 px min, 2 px ink
 * ring, 10 px bold onEmber digits; > 9 shows "9+". Position it yourself
 * (the header puts it at top -4 / right -6).
 */
export function CountBadge({
  count,
  className,
  style,
  testID,
}: {
  count: number;
  className?: string;
  style?: CSSProperties;
  testID?: string;
}) {
  if (count <= 0) return null;
  return (
    <span className={clsx('v2-badge', className)} style={style} data-testid={testID}>
      <AppText variant="tabLabel" color="currentColor" style={{ lineHeight: '12px' }}>
        {count > 9 ? '9+' : String(count)}
      </AppText>
    </span>
  );
}

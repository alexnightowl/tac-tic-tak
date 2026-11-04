'use client';

import { layout } from '@tac/core/tokens';
import clsx from 'clsx';
import { ChevronLeft, X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { useT } from '@/lib/i18n';
import { AppText } from './AppText';
import { IconButton } from './Buttons';
import './kit.css';

export type BackVariant = 'back' | 'float' | 'glass';

/** `.glass` back glyph: `M15 5l-7 7 7 7`, 20 px, stroke 2.2. */
function GlassChevron() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

/**
 * The nested-screen back button. `back` = `.back` (settings: bone/6 % fill,
 * 22 px chevron), `float` = `.float` (history, viewer: 20 px chevron),
 * `glass` = `.glass` (profile, friends: the wider 20 px chevron).
 * `glyph="close"` swaps in the 20 px × of the drill / mistakes screens.
 * A link with `href`, else a button calling `onPress`.
 */
export function BackButton({
  variant = 'back',
  glyph = 'chevron',
  onPress,
  href,
  testID = 'BackButton',
  accessibilityLabel,
}: {
  variant?: BackVariant;
  glyph?: 'chevron' | 'close';
  onPress?: () => void;
  href?: string;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const t = useT();
  let icon: ReactNode;
  if (glyph === 'close') icon = <X size={20} strokeWidth={2} aria-hidden />;
  else if (variant === 'glass') icon = <GlassChevron />;
  else icon = <ChevronLeft size={variant === 'back' ? 22 : 20} strokeWidth={2.2} aria-hidden />;
  return (
    <IconButton
      variant={variant}
      icon={icon}
      onPress={onPress}
      href={href}
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? t('shell.back')}
    />
  );
}

/**
 * Nested-screen header (`.back` pattern): a 54 px row (44 with `compact`,
 * the `.glass` screens), serif 18 title centred, the round back button 16 px
 * from the left (5 px from the row top), an optional right action mirrored
 * on the right. Ink ground unless `transparent`; `safeTop` pads by the
 * safe-area inset (installed PWA on a notched phone).
 */
export function NavHeader({
  title,
  titleNode,
  onBack,
  backHref,
  backVariant = 'back',
  backGlyph,
  backTestID,
  backLabel,
  right,
  compact = false,
  transparent = false,
  safeTop = true,
  testID = 'nav-header',
  className,
  style,
}: {
  title?: string;
  /** Custom centre node (e.g. a title that fades in on scroll). */
  titleNode?: ReactNode;
  /** Omit both onBack and backHref to hide the back button. */
  onBack?: () => void;
  backHref?: string;
  backVariant?: BackVariant;
  backGlyph?: 'chevron' | 'close';
  backTestID?: string;
  backLabel?: string;
  right?: ReactNode;
  compact?: boolean;
  transparent?: boolean;
  safeTop?: boolean;
  testID?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const h = compact ? layout.navHeaderCompactHeight : layout.navHeaderHeight;
  const top = compact ? 0 : layout.headerButtonTop;
  return (
    <header
      className={clsx('v2-nav', !transparent && 'v2-nav--ground', safeTop && 'v2-nav--safe', className)}
      style={style}
      data-testid={testID}
    >
      <div className="v2-nav-row" style={{ height: h }}>
        {titleNode ??
          (title ? (
            <AppText as="h1" variant="navTitle" numberOfLines={1} style={{ textAlign: 'center' }}>
              {title}
            </AppText>
          ) : null)}
        {onBack || backHref ? (
          <div className="v2-nav-left" style={{ top }}>
            <BackButton
              variant={backVariant}
              glyph={backGlyph}
              onPress={onBack}
              href={backHref}
              testID={backTestID}
              accessibilityLabel={backLabel}
            />
          </div>
        ) : null}
        {right ? (
          <div className="v2-nav-right" style={{ top }}>
            {right}
          </div>
        ) : null}
      </div>
    </header>
  );
}

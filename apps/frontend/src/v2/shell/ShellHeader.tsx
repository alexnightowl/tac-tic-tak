'use client';

import { layout } from '@tac/core/tokens';
import clsx from 'clsx';
import Link from 'next/link';

import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { AppText, Avatar, BrandLogo, CountBadge, HEADER_LOGO_GLOW, Press } from '@/v2/ui';
import { VISIBLE_TABS } from './tabs';
import { useIncomingRequestCount } from './useShellData';

/** The wordmark (Latin in every language, so always the Latin display face). */
export function Brand({ className }: { className?: string }) {
  const t = useT();
  return (
    <Link href={VISIBLE_TABS[0].href} className={clsx('v2-brand v2-reset v2-focus', className)} aria-label={t('brand.name')}>
      <BrandLogo size={layout.shellLogo} glow={HEADER_LOGO_GLOW} />
      <AppText variant="brand" lang="en" numberOfLines={1} aria-hidden>
        {t('brand.name')}
      </AppText>
    </Link>
  );
}

/**
 * The avatar button that opens the account menu, with the incoming
 * friend-request count (app ShellHeader). Until /users/me lands it keeps
 * its footprint as an empty disc so the header does not reflow.
 */
export function AvatarButton({ size, onPress, testID }: { size: number; onPress: () => void; testID: string }) {
  const t = useT();
  const user = useAppStore((s) => s.user);
  const incoming = useIncomingRequestCount();
  if (!user) return <span className="v2-av-ghost" style={{ width: size, height: size }} aria-hidden />;
  return (
    <Press
      testID={testID}
      onPress={onPress}
      aria-haspopup="dialog"
      aria-label={incoming ? `${t('shell.menu.open')}, ${incoming}` : t('shell.menu.open')}
      className="v2-avatar-btn"
    >
      <Avatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={size} />
      <CountBadge count={incoming} style={{ position: 'absolute', top: -4, right: -6 }} testID={`${testID}-badge`} />
    </Press>
  );
}

/**
 * Top bar of every tab below 1024 px (app shell/ShellHeader.tsx): a 56 px
 * row on the ink ground, the 32 px knight with its 120 px ember glow and
 * the Cinzel 20/22 wordmark (gap 10), and the 36 px avatar on the right.
 */
export function ShellHeader({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="v2-shell-header" data-testid="shell-header">
      <Brand />
      <AvatarButton size={layout.shellAvatar} onPress={onMenu} testID="header-avatar" />
    </header>
  );
}

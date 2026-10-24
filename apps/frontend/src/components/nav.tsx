'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { HomeIcon, PlayIcon, ReviewIcon, LeaderboardIcon, StatsIcon, ShurikenIcon } from '@/components/NavIcons';
import { setToken } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/Avatar';

const items = (t: (k: string) => string) => [
  { href: '/dashboard',   label: t('home'),       Icon: HomeIcon },
  { href: '/play',        label: t('play'),       Icon: PlayIcon },
  { href: '/review',      label: t('review'),     Icon: ReviewIcon },
  { href: '/leaderboard', label: t('leaderboard'),Icon: LeaderboardIcon },
  { href: '/analytics',   label: t('stats'),      Icon: StatsIcon },
  { href: '/settings',    label: t('settings'),   Icon: ShurikenIcon },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const t = useT();

  // Keep the header mounted even before /users/me resolves — otherwise
  // the whole page reflows vertically when the nav pops in on hydration.
  // User-specific bits (nickname / avatar) fall back to placeholders
  // during the brief null window.
  const nickname = user?.nickname ?? '';
  const avatarUrl = user?.avatarUrl;

  const nav = items(t);
  const logout = () => {
    setToken(null);
    setUser(null);
    router.replace('/login');
  };

  return (
    <>
      {/* Desktop top app bar */}
      <header className="hidden md:flex items-center justify-between px-6 py-3 bg-eos-shade shadow-[inset_0_-1px_0_var(--eos-seam)]">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Logo size={40} glow />
          <span className="font-serif font-bold tracking-[0.04em] text-[24px] text-eos-bone leading-none">tac·tic·tak</span>
        </Link>
        <nav className="flex gap-1">
          {nav.map(({ href, label, Icon }) => (
            <Link key={href} href={href}
              className={cn('relative px-3 py-2 rounded-control text-sm font-bold flex items-center gap-2 transition-colors',
                pathname?.startsWith(href)
                  ? 'text-eos-bone'
                  : 'text-eos-dust hover:text-eos-bone')}>
              <Icon active={!!pathname?.startsWith(href)} /> {label}
              {pathname?.startsWith(href) && <span className="absolute -bottom-3 left-3 right-3 h-[2px] rounded-full bg-eos-ember" />}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {/* Fixed-width slot so the row doesn't reflow horizontally
              when the nickname resolves from /users/me. */}
          <div className="flex items-center gap-3 text-sm text-zinc-300 justify-end min-w-[240px]">
            {user ? (
              <Link href={`/profile/${nickname}`} className="flex items-center gap-3 hover:text-white max-w-full min-w-0">
                <Avatar nickname={nickname} avatarUrl={avatarUrl} size={40} />
                <span className="truncate min-w-0 font-bold">{nickname}</span>
              </Link>
            ) : (
              <div className="flex items-center gap-3" aria-hidden>
                <div className="h-10 w-10 rounded-full bg-white/5 shrink-0" />
                <div className="h-3 w-28 rounded bg-white/5" />
              </div>
            )}
          </div>
          <button
            onClick={logout}
            disabled={!user}
            className="text-zinc-400 hover:text-white disabled:opacity-50"
            aria-label={t('logout')}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Mobile top app bar */}
      <header className="md:hidden flex h-14 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo size={32} glow />
          <span className="font-serif font-bold tracking-[0.04em] text-[20px] text-eos-bone leading-none">tac·tic·tak</span>
        </Link>
        {user ? (
          <Link href={`/profile/${nickname}`} aria-label="Profile" className="shrink-0">
            <Avatar nickname={nickname} avatarUrl={avatarUrl} size={36} />
          </Link>
        ) : (
          <div className="h-9 w-9 rounded-full bg-white/5" aria-hidden />
        )}
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-eos-shade shadow-[inset_0_1px_0_var(--eos-seam)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-6">
          {nav.map(({ href, label, Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold leading-none transition-colors',
                  active ? 'text-eos-bone' : 'text-eos-dust',
                )}
              >
                <span className={cn('absolute top-0 left-[28%] right-[28%] h-[2px] rounded-full', active ? 'bg-eos-ember' : 'bg-transparent')} />
                <span className="flex h-6 items-center justify-center"><Icon active={!!active} /></span>
                <span className="max-w-full truncate px-0.5">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Swords, BookOpen, BarChart3, Settings as SettingsIcon, LogOut, Trophy } from 'lucide-react';
import { setToken } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/Avatar';

const items = (t: (k: string) => string) => [
  { href: '/dashboard',   label: t('home'),       Icon: Home },
  { href: '/play',        label: t('play'),       Icon: Swords },
  { href: '/review',      label: t('review'),     Icon: BookOpen },
  { href: '/leaderboard', label: t('leaderboard'),Icon: Trophy },
  { href: '/analytics',   label: t('stats'),      Icon: BarChart3 },
  { href: '/settings',    label: t('settings'),   Icon: SettingsIcon },
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
      <header className="hidden md:flex items-center justify-between px-6 py-3 glass rounded-b-none border-b border-[var(--border-soft)]">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Logo size={64} />
          <span className="font-display font-bold tracking-tight text-[32px] text-white leading-none">
            tac<span className="text-[var(--accent)]">·</span>tic<span className="text-[var(--accent)]">·</span>tak
          </span>
        </Link>
        <nav className="flex gap-1">
          {nav.map(({ href, label, Icon }) => (
            <Link key={href} href={href}
              className={cn('px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors',
                pathname?.startsWith(href)
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5')}>
              <Icon size={16} /> {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {/* Fixed-width slot so the row doesn't reflow horizontally
              when the nickname resolves from /users/me. */}
          <div className="flex items-center gap-3 text-sm text-zinc-300 justify-end min-w-[240px]">
            {user ? (
              <Link href={`/profile/${nickname}`} className="flex items-center gap-3 hover:text-white truncate max-w-full">
                <Avatar nickname={nickname} avatarUrl={avatarUrl} size={56} />
                <span className="truncate">{nickname}</span>
              </Link>
            ) : (
              <div className="flex items-center gap-3" aria-hidden>
                <div className="h-14 w-14 rounded-full bg-white/5 shrink-0" />
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
      <header className="md:hidden flex items-center justify-between px-4 pt-3 pb-2">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo size={56} />
          <span className="font-display font-bold tracking-tight text-[28px] text-white leading-none">
            tac<span className="text-[var(--accent)]">·</span>tic<span className="text-[var(--accent)]">·</span>tak
          </span>
        </Link>
        {user ? (
          <Link href={`/profile/${nickname}`} className="h-[56px] w-[56px] rounded-full glass flex items-center justify-center overflow-hidden" aria-label="Profile">
            <Avatar nickname={nickname} avatarUrl={avatarUrl} size={56} />
          </Link>
        ) : (
          <div className="h-[56px] w-[56px] rounded-full bg-white/5" aria-hidden />
        )}
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-[var(--border-soft)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-6">
          {nav.map(({ href, label, Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link key={href} href={href} className="relative flex flex-col items-center justify-center gap-1 py-2.5">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.7}
                  className={cn('transition-colors', active ? 'text-[var(--accent)]' : 'text-zinc-400')}
                />
                <span className={cn('text-[10px] leading-none transition-colors', active ? 'text-[var(--accent)] font-medium' : 'text-zinc-500')}>
                  {label}
                </span>
                {active && <span className="absolute bottom-0 h-[3px] w-8 rounded-full bg-[var(--accent)]" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

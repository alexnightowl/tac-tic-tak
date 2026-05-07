'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getToken } from '@/lib/api';
import { Nav } from '@/components/nav';
import { PullToRefresh } from '@/components/PullToRefresh';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  // Hide chrome on board-runner pages (focus mode) — play, theme review,
  // and session review all need full viewport so the board can match the
  // size players see during a session. Without this they'd be clamped by
  // the global max-w-5xl wrapper to a postage-stamp on wide monitors.
  const inPlayRunner = pathname?.startsWith('/play/') && pathname.split('/').length >= 3;
  const inThemeReview = pathname?.startsWith('/review/') && pathname.split('/').length >= 3;
  const inSessionReview = pathname ? /^\/sessions\/[^/]+\/review$/.test(pathname) : false;
  const focusMode = inPlayRunner || inThemeReview || inSessionReview;

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  if (focusMode) {
    return <div className="relative min-h-dvh">{children}</div>;
  }

  const refresh = async () => {
    await qc.invalidateQueries();
  };

  // Nav renders OUTSIDE the pull-to-refresh wrapper because its mobile tab
  // bar is position:fixed — a transformed ancestor would trap it (fixed
  // children anchor to the nearest transformed ancestor, not the viewport).
  return (
    <div className="relative min-h-dvh pb-24 md:pb-0">
      <Nav />
      <PullToRefresh onRefresh={refresh}>
        <main className="relative max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-6">{children}</main>
      </PullToRefresh>
    </div>
  );
}

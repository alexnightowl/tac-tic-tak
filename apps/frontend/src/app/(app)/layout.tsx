'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';
import { Nav } from '@/components/nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Hide chrome on the play runner itself (focus mode) — just show content.
  const inPlayRunner = pathname?.startsWith('/play/') && pathname.split('/').length >= 3;

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  if (inPlayRunner) {
    return <div className="relative min-h-dvh">{children}</div>;
  }

  return (
    <div className="relative min-h-dvh pb-24 md:pb-0">
      <Nav />
      <main className="relative max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-6">{children}</main>
    </div>
  );
}

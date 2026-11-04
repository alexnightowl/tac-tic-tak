'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getToken } from '@/lib/api';
import { PullToRefresh } from '@/components/PullToRefresh';
import { AppShell } from '@/v2/shell/AppShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  const refresh = async () => {
    await qc.invalidateQueries();
  };

  // The shell frames the page (header + tab bar on phones, the rail on
  // desktop) and leaves board runners bare (src/v2/shell/routes.ts).
  return <AppShell wrap={(page) => <PullToRefresh onRefresh={refresh}>{page}</PullToRefresh>}>{children}</AppShell>;
}

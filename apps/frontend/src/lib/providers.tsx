'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { http, getToken } from './api';
import { useAppStore } from './store';
import type { Progressions } from './store';

type Me = {
  id: string;
  nickname: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  country?: string | null;
  settings: any;
  progressions: Progressions;
  defaultStyle?: string;
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  }));
  const setUser = useAppStore((s) => s.setUser);
  const setSettings = useAppStore((s) => s.setSettings);
  const setProgressions = useAppStore((s) => s.setProgressions);

  useEffect(() => {
    if (!getToken()) return;
    http.get<Me>('/users/me')
      .then((me) => {
        setUser({
          id: me.id,
          nickname: me.nickname,
          displayName: me.displayName,
          avatarUrl: me.avatarUrl,
          bio: me.bio,
          country: me.country,
        });
        if (me.settings) setSettings(me.settings);
        if (me.progressions) setProgressions(me.progressions);
      })
      .catch(() => {});
  }, [setUser, setSettings, setProgressions]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

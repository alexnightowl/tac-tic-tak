'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { http, getToken } from './api';
import { useAppStore } from './store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  }));
  const setUser = useAppStore((s) => s.setUser);
  const setSettings = useAppStore((s) => s.setSettings);
  const setProgression = useAppStore((s) => s.setProgression);

  useEffect(() => {
    if (!getToken()) return;
    http.get<{ id: string; nickname: string; settings: any; progression: any }>('/users/me')
      .then((me) => {
        setUser({ id: me.id, nickname: me.nickname });
        if (me.settings) setSettings(me.settings);
        if (me.progression) setProgression(me.progression);
      })
      .catch(() => {});
  }, [setUser, setSettings, setProgression]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useState } from 'react';
import { http, getToken } from './api';
import { useAppStore } from './store';
import type { Progressions } from './store';

// useLayoutEffect warns during SSR; swap it out on the server.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type Me = {
  id: string;
  nickname: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  country?: string | null;
  settings: any;
  progressions: Progressions;
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  }));
  const setUser = useAppStore((s) => s.setUser);
  const setSettings = useAppStore((s) => s.setSettings);
  const setProgressions = useAppStore((s) => s.setProgressions);
  const setSettingsReady = useAppStore((s) => s.setSettingsReady);

  // Rehydrate settings from localStorage BEFORE first paint on the client.
  // If the cache exists we can immediately mark ready — the board then
  // never paints with the store defaults. If there's no cache, stay
  // un-ready until /users/me resolves (or until we know the user isn't
  // authed), and consumers skip rendering rather than flashing defaults.
  useIsoLayoutEffect(() => {
    try {
      const raw = window.localStorage.getItem('taktic.settings');
      if (raw) {
        setSettings(JSON.parse(raw));
        setSettingsReady(true);
      }
    } catch {}
  }, [setSettings, setSettingsReady]);

  useEffect(() => {
    if (!getToken()) {
      // Not authenticated — honour the language picked on the landing page
      // (or remembered from a previous session) so the login/register UI
      // renders in the right language.
      try {
        const stored = window.localStorage.getItem('taktic.lang');
        if (stored === 'en' || stored === 'uk') setSettings({ language: stored });
      } catch {}
      // No authed settings to fetch — unblock any gated UI.
      setSettingsReady(true);
      return;
    }
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
      .catch(() => {})
      .finally(() => setSettingsReady(true));
  }, [setUser, setSettings, setProgressions, setSettingsReady]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

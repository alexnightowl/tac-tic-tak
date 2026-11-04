'use client';

import { http, setToken } from '@/lib/api';
import { useAppStore, type Progressions, type UserSettings } from '@/lib/store';

type AuthResponse = { token: string; user: { id: string; nickname: string } };

type Me = {
  id: string;
  nickname: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  country?: string | null;
  verified?: boolean;
  isAdmin?: boolean;
  settings?: Partial<UserSettings>;
  progressions?: Progressions;
};

/**
 * Store the token, then pull the full profile and settings at once. The
 * Providers' /users/me effect only runs on mount, so without this the
 * first screen would paint with the defaults (or, after a log out and a
 * new account in the same tab, the previous player's progressions).
 */
async function adopt(r: AuthResponse) {
  const { setUser, setSettings, setProgressions } = useAppStore.getState();
  setToken(r.token);
  setUser(r.user);
  try {
    const me = await http.get<Me>('/users/me');
    setUser({
      id: me.id,
      nickname: me.nickname,
      displayName: me.displayName,
      avatarUrl: me.avatarUrl,
      bio: me.bio,
      country: me.country,
      verified: me.verified,
      isAdmin: me.isAdmin,
    });
    if (me.settings) setSettings(me.settings);
    if (me.progressions) setProgressions(me.progressions);
  } catch {
    // Non-fatal: Providers reconcile on the next mount.
  }
}

export async function login(nickname: string, password: string) {
  await adopt(await http.post<AuthResponse>('/auth/login', { nickname, password }));
}

export async function register(nickname: string, password: string, repeat: string, language: string) {
  await adopt(await http.post<AuthResponse>('/auth/register', { nickname, password, repeatPassword: repeat, language }));
}

/**
 * The web API client throws `Error(serverMessage)`; map the known ones to
 * i18n keys as the app does (features/auth/strings.ts). A failed fetch is
 * a TypeError in every browser.
 */
export function authErrorKey(e: unknown): string {
  if (e instanceof TypeError) return 'auth.err_network';
  const msg = e instanceof Error ? e.message : '';
  if (/invalid credentials/i.test(msg)) return 'auth.err_invalid';
  if (/already taken/i.test(msg)) return 'auth.err_taken';
  return 'auth.err_generic';
}

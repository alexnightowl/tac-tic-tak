import type { AuthUser } from '@tac/core/api';
import { create } from 'zustand';

import { appKV, readJSON, writeJSON } from '@/platform/storage';

// Who is signed in (PLAN §2.4). The token itself lives in secure-store
// (src/platform/token.ts) and is mirrored here in memory once loaded.
// `taktic.hasSession` in MMKV makes the first route decision synchronous:
// with it the app boots straight into (app) while the keychain read runs
// behind the splash; without it, straight to login.

export type AuthStatus = 'booting' | 'anon' | 'authed';

export type CachedUser = AuthUser & {
  displayName?: string | null;
  avatarUrl?: string | null;
  verified?: boolean;
  isAdmin?: boolean;
};

export const AUTH_KEYS = {
  hasSession: 'taktic.hasSession',
  user: 'taktic.user',
} as const;

type AuthState = {
  status: AuthStatus;
  user: CachedUser | null;
  /** In memory only; null until secure-store has been read. */
  token: string | null;
  /** Token known but the account not committed yet (login awaiting /users/me). */
  setPendingToken: (token: string) => void;
  signIn: (token: string, user: CachedUser) => void;
  setUser: (user: CachedUser) => void;
  signOut: () => void;
};

const hadSession = appKV.getBoolean(AUTH_KEYS.hasSession) === true;

export const useAuthStore = create<AuthState>((set) => ({
  status: hadSession ? 'booting' : 'anon',
  user: hadSession ? readJSON<CachedUser | null>(appKV, AUTH_KEYS.user, null) : null,
  token: null,
  setPendingToken: (token) => set({ token }),
  signIn: (token, user) => {
    appKV.set(AUTH_KEYS.hasSession, true);
    writeJSON(appKV, AUTH_KEYS.user, user);
    set({ status: 'authed', token, user });
  },
  setUser: (user) => {
    writeJSON(appKV, AUTH_KEYS.user, user);
    set({ user });
  },
  signOut: () => {
    appKV.remove(AUTH_KEYS.hasSession);
    appKV.remove(AUTH_KEYS.user);
    set({ status: 'anon', token: null, user: null });
  },
}));

export const authStore = useAuthStore;

/** Guard input: a booting session is treated as signed in (cached Home). */
export function useIsSignedIn(): boolean {
  return useAuthStore((s) => s.status !== 'anon');
}

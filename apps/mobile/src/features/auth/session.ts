import { queryKeys, type AuthResponse, type MeResponse } from '@tac/core/api';
import type { Language } from '@tac/core/i18n';
import { queryOptions } from '@tanstack/react-query';

import { api, currentToken, setTokenGate, setUnauthorizedHandler } from '@/platform/api';
import { queryClient } from '@/platform/query';
import { queryKV, sessionKV } from '@/platform/storage';
import { clearToken, loadToken, saveToken } from '@/platform/token';
import { appStore } from '@/stores/appStore';
import { authStore, type CachedUser } from '@/stores/authStore';

// Session lifecycle: boot, login, /users/me bootstrap, resetAll (PLAN §2.4).

function cachedUserOf(me: MeResponse): CachedUser {
  return {
    id: me.id,
    nickname: me.nickname,
    displayName: me.displayName,
    avatarUrl: me.avatarUrl,
    verified: me.verified,
    isAdmin: me.isAdmin,
  };
}

/**
 * ['me'] doubles as the bootstrap: its queryFn writes the body into the
 * stores, so invalidating ['me'] (after a finish) refreshes the ratings
 * everywhere. Screens read the stores, not this query's data.
 */
export const meQuery = queryOptions({
  queryKey: queryKeys.me(),
  queryFn: async () => {
    // Read after the keychain gate: on a cold start Home mounts (and starts
    // this query) before the token is in memory, and a null here would
    // drop the fresh body.
    const sentWith = await currentToken();
    const me = await api.users.me();
    // A logout (or another login) while the request was in flight must
    // not write this body into the stores.
    if (sentWith && authStore.getState().token === sentWith) {
      appStore.getState().applyMe(me);
      authStore.getState().setUser(cachedUserOf(me));
    }
    return me;
  },
});

let resetting = false;

/**
 * Logout and session expiry. RN has no hard reload, so everything
 * user-scoped is cleared explicitly; flipping authStore to anon makes the
 * Stack.Protected guard drop (app) and land on login.
 */
export async function resetAll(): Promise<void> {
  if (resetting) return;
  resetting = true;
  try {
    authStore.getState().signOut();
    appStore.getState().reset();
    queryClient.clear();
    queryKV.clearAll();
    // Runner snapshot + outbox belong to the account that played them.
    sessionKV.clearAll();
    await clearToken();
  } finally {
    resetting = false;
  }
}

setUnauthorizedHandler(() => {
  void resetAll();
});

/**
 * Cold start. With `hasSession` the app is already showing (app) from the
 * MMKV cache behind the splash; the keychain read confirms it.
 */
export function boot(): Promise<void> {
  const read = loadToken();
  // Requests wait for the whole boot decision (token in memory, or the
  // session dropped), not just the keychain read.
  const done = read.then(async (token) => {
    const { status, user } = authStore.getState();
    if (status !== 'booting') {
      // No MMKV session: a keychain token left over from a reinstall
      // (iOS keeps Keychain items) is stale, drop it.
      if (token && status === 'anon') await clearToken();
      return;
    }
    if (!token) {
      await resetAll();
      return;
    }
    authStore.getState().signIn(token, user ?? { id: '', nickname: '' });
  });
  setTokenGate(done);
  // Background revalidation; offline keeps the cached Home. Deduped with
  // Home's own ['me'] query when that mounted first.
  void done.then(
    () => {
      if (authStore.getState().status === 'authed') void queryClient.prefetchQuery(meQuery);
    },
    () => {},
  );
  return done;
}

/** Login form submit. Throws the ApiError for the form to show. */
export async function login(nickname: string, password: string): Promise<void> {
  await signIn(await api.auth.login({ nickname, password }));
}

/** Register form submit (web register page): creates the account and signs in. */
export async function register(nickname: string, password: string, repeatPassword: string, language?: Language): Promise<void> {
  await signIn(await api.auth.register({ nickname, password, repeatPassword, language }));
}

async function signIn(r: AuthResponse): Promise<void> {
  await saveToken(r.token);
  // Previous account's data must not leak into this one (web register comment).
  appStore.getState().reset();
  queryClient.clear();
  // Token first, account second: /users/me runs before the guard flips,
  // so Home's first frame already has this user's ratings.
  authStore.getState().setPendingToken(r.token);
  try {
    await queryClient.fetchQuery({ ...meQuery, staleTime: 0 });
  } catch {
    // Non-fatal, like the web: Home refetches ['me'] on mount.
  }
  const cached = authStore.getState().user;
  authStore.getState().signIn(r.token, cached?.id === r.user.id ? cached : r.user);
}

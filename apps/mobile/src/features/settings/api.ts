import { createApiClient, isApiError, queryKeys, type MeResponse, type Progressions } from '@tac/core/api';
import { Platform } from 'react-native';

import { resetAll } from '@/features/auth/session';
import { apiClient, currentToken } from '@/platform/api';
import { API_URL, APP_VERSION } from '@/platform/config';
import { queryClient } from '@/platform/query';
import { appStore } from '@/stores/appStore';

// Account routes the settings screens call. Not in core's endpoint list yet
// (Phase 9 owns them); move there when B2's /v1 paths land.

/**
 * A client that never treats a 401 as "session gone". Today a wrong
 * current password on change-password answers 401, which the main client
 * turns into resetAll() (the web logged the user out on a typo). Here the
 * 401 stays a form error (PLAN §2.4; B5 makes it a 403 for every client).
 */
const formClient = createApiClient({
  baseUrl: API_URL,
  getToken: currentToken,
  timeoutMs: 10_000,
  headers: { 'X-Platform': Platform.OS, 'X-App-Version': APP_VERSION },
});

/** The server's wrong-current-password answer (auth.service). */
const WRONG_CURRENT = /current password/i;

export type FormErrorKey =
  | 'settings.account.err_current'
  | 'settings.account.err_same'
  | 'auth.err_network'
  | 'auth.err_timeout'
  | 'auth.err_generic';

/** Maps a change-password / delete failure to a localised message key. */
export function formErrorKey(e: unknown): FormErrorKey {
  if (!isApiError(e)) return 'auth.err_generic';
  if (e.kind === 'network') return 'auth.err_network';
  if (e.kind === 'timeout') return 'auth.err_timeout';
  // 401 today, 403 after B5: both mean "current password is wrong".
  if ((e.status === 401 && WRONG_CURRENT.test(e.message)) || e.status === 403) return 'settings.account.err_current';
  if (e.status === 400 && /differ/i.test(e.message)) return 'settings.account.err_same';
  return 'auth.err_generic';
}

/**
 * POST /auth/change-password through the form client. Only the
 * wrong-current-password 401 stays a form error; any other 401 (the token
 * itself expired or was revoked) is a real session end and signs out, as
 * the main client would.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: true }> {
  try {
    return await formClient.post('/auth/change-password', { currentPassword, newPassword });
  } catch (e) {
    if (isApiError(e) && e.status === 401 && !WRONG_CURRENT.test(e.message)) void resetAll();
    throw e;
  }
}

/**
 * POST /users/me/reset-progress, then refresh /users/me and drop every
 * cached read (the web left analytics / sessions stale until a refetch).
 */
export async function resetProgress(): Promise<void> {
  await apiClient.post('/users/me/reset-progress');
  const me = await apiClient.get<MeResponse>('/users/me');
  appStore.getState().applyMe(me);
  queryClient.setQueryData(queryKeys.me(), me);
  await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
}

/**
 * POST /users/me/recalibrate: every style gets a fresh calibration window
 * (ratings and history stay), so the next rated sessions re-place the norm.
 */
export async function recalibrate(): Promise<void> {
  const res = await apiClient.post<{ progressions: Progressions }>('/users/me/recalibrate', {});
  appStore.getState().setProgressions(res.progressions);
  await queryClient.invalidateQueries({ queryKey: queryKeys.me() });
}

/** B4 (not on the server yet): revokes every refresh family and bumps tokenVersion. */
export function logoutAll(): Promise<unknown> {
  return apiClient.post('/auth/logout-all');
}

/** B10 (not on the server yet): DELETE /users/me {password} → 204. */
export function deleteAccount(password: string): Promise<unknown> {
  return formClient.request('/users/me', { method: 'DELETE', body: { password } });
}

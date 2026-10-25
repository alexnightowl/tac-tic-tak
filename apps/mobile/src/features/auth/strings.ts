import { isApiError } from '@tac/core/api';

import { useT, type TFn } from '@/ui/lang';

// The Phase 2 local table moved into @tac/core/i18n (areas/auth + common);
// useAuthT is plain useT, kept so existing call sites stay unchanged.

export type AuthT = TFn;

export function useAuthT(): AuthT {
  return useT();
}

/**
 * The web showed the server's English message raw; mobile maps the known
 * ones to i18n keys (inventory "Map server error messages to i18n keys").
 */
export function loginErrorKey(e: unknown): string {
  if (isApiError(e)) {
    if (e.kind === 'timeout') return 'auth.err_timeout';
    if (e.kind === 'network') return 'auth.err_network';
    if (e.status === 401) return 'auth.err_invalid';
    if (e.status === 400 && /already taken/i.test(e.message)) return 'auth.err_taken';
  }
  return 'auth.err_generic';
}

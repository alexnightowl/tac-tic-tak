import { isApiError } from '@tac/core/api';

import { useT, type TFn } from '@/ui/lang';

// The Phase 2 local table (exit sheet, timer, start errors) moved into
// @tac/core/i18n (areas/play); usePlayT is plain useT, kept so existing
// call sites stay unchanged.

export type PlayT = TFn;

export function usePlayT(): PlayT {
  return useT();
}

/** POST /sessions failure → a translated message (the web showed e.message raw). */
export function startErrorKey(e: unknown): string {
  if (isApiError(e) && (e.kind === 'network' || e.kind === 'timeout')) return 'play.err_network';
  return 'play.err_start';
}

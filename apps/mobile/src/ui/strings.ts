import { useT, type TFn } from './lang';

/**
 * Kept for the Phase 1/2 call sites: the primitives' local table moved into
 * @tac/core/i18n (areas/common), so this is plain useT now. New code calls
 * useT() directly.
 */
export function useUiT(): TFn {
  return useT();
}

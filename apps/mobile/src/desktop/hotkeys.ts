import { useEffect, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Key → handler. Keys are KeyboardEvent.key values ('h', ' ', 'Escape',
 * 'ArrowRight', '1'); a 'mod+' prefix means ⌘ on a Mac, Ctrl elsewhere
 * ('mod+k'). Letters match either case.
 */
export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

function typing(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Desktop keyboard shortcuts (canvas "Desktop — redesign": Space to start,
 * 1 2 3 modes, H hint, S skip, F flip, Esc pause, ⌘K search). Window-level,
 * ignored while a text field has focus (except Escape) and while `enabled`
 * is false. The handlers are read through a ref, so an inline map does not
 * re-subscribe every render. No-op off the web.
 */
export function useHotkeys(map: HotkeyMap, enabled = true): void {
  const ref = useRef(map);
  useLayoutEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey) return;
      const mod = e.metaKey || e.ctrlKey;
      if (typing(e) && e.key !== 'Escape' && !mod) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const h = ref.current[mod ? `mod+${k}` : k];
      if (!h || (mod && !ref.current[`mod+${k}`])) return;
      e.preventDefault();
      h(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

/** The platform's modifier glyph for key caps: ⌘ on a Mac, Ctrl elsewhere. */
export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '') ? '⌘' : 'Ctrl';

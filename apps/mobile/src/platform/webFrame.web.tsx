import { eos, space } from '@tac/core/tokens';
import { usePathname } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

import { RAIL_W, WebRail } from '@/shell/WebRail';
import { useAuthStore } from '@/stores/authStore';

// On a wide browser window the app keeps its phone layout in a centred
// column (D35). Screens size themselves from useWindowDimensions(), so the
// window width they see is clamped to the column; height stays real.
export const WEB_FRAME_MAX = 600;

type Dims = { width: number; height: number; scale: number; fontScale: number };
const clamp = (d: Dims): Dims => (d.width > WEB_FRAME_MAX ? { ...d, width: WEB_FRAME_MAX } : d);

// Patch once per page: a fast refresh re-runs this module and must not wrap
// the already-clamped functions again.
type DimsEvent = { window: Dims; screen: Dims };
type RawDims = {
  get: (dim: 'window' | 'screen') => Dims;
  add: (type: 'change', h: (e: DimsEvent) => void) => { remove: () => void };
};
const g = globalThis as { __ttRawDims?: RawDims };
const raw: RawDims = (g.__ttRawDims ??= {
  get: Dimensions.get.bind(Dimensions) as RawDims['get'],
  add: Dimensions.addEventListener.bind(Dimensions) as unknown as RawDims['add'],
});
const rawGet = raw.get;
const rawAdd = raw.add;

Dimensions.get = ((dim: 'window' | 'screen') => (dim === 'window' ? clamp(rawGet(dim)) : rawGet(dim))) as typeof Dimensions.get;

const wrapped = new WeakMap<object, (e: DimsEvent) => void>();
Dimensions.addEventListener = ((type: 'change', handler: (e: DimsEvent) => void) => {
  const w = (e: DimsEvent) => handler({ ...e, window: clamp(e.window) });
  wrapped.set(handler, w);
  return rawAdd(type, w);
}) as typeof Dimensions.addEventListener;
// react-native-web's useWindowDimensions unsubscribes through removeEventListener.
const dimsWithRemove = Dimensions as unknown as { removeEventListener?: (t: string, h: object) => void; __ttRawRemove?: (t: string, h: object) => void };
dimsWithRemove.__ttRawRemove ??= dimsWithRemove.removeEventListener?.bind(Dimensions);
const rawRemove = dimsWithRemove.__ttRawRemove;
if (rawRemove) {
  dimsWithRemove.removeEventListener = (type, handler) => rawRemove(type, wrapped.get(handler) ?? handler);
}

// Desktop affordances react-native-web leaves out: a hand over anything
// clickable, no text selection when a button is clicked or dragged, and no
// browser focus ring on text fields (the app's inputs draw their own).
const CSS = `
html, body { background-color: ${eos.ink}; }
[role="button"], [role="link"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"] {
  cursor: pointer; user-select: none; -webkit-user-select: none;
}
[aria-disabled="true"] { cursor: default; }
input, textarea { outline: none; }
`;
if (typeof document !== 'undefined') {
  const el = document.getElementById('tt-web-css') ?? document.head.appendChild(document.createElement('style'));
  el.id = 'tt-web-css';
  el.textContent = CSS;
}

/** From this real window width the web shows the rail instead of the tab bar. */
const WIDE_MIN = 1024;

/** True on a desktop-wide browser window (the rail replaces header + tab bar). */
export function useWideWeb(): boolean {
  const [wide, setWide] = useState(() => rawGet('window').width >= WIDE_MIN);
  useEffect(() => {
    const sub = rawAdd('change', (e) => setWide(e.window.width >= WIDE_MIN));
    return () => sub.remove();
  }, []);
  return wide;
}

/**
 * Screens that own the whole window (a runner, an exam, onboarding): no
 * rail, like the app's full-screen routes.
 */
const FOCUS = [
  /^\/onboarding/,
  /^\/play\/(?!levels|theme-picker)[^/]+$/,
  /^\/review\/[^/]+$/,
  /^\/sessions\/[^/]+\/review/,
  /^\/storm\/run/,
  /^\/(course|library|offline)\/(solve|exam)/,
  /^\/challenge\/[^/]+$/,
];

export function WebFrame({ children }: { children: ReactNode }) {
  const wide = useWideWeb();
  const signedIn = useAuthStore((st) => st.status === 'authed');
  const path = usePathname();
  const rail = wide && signedIn && !FOCUS.some((re) => re.test(path));
  return (
    <View style={styles.ground}>
      {rail && (
        <View style={styles.railSlot}>
          <WebRail />
        </View>
      )}
      <View style={[styles.stage, rail && styles.stageRail]}>
        <View style={styles.column}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: eos.ink },
  railSlot: { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 2 },
  stage: { flex: 1, alignItems: 'center' },
  // The rail took the header's place: give the column the air the header had.
  stageRail: { marginLeft: RAIL_W, paddingTop: space[6] },
  column: { flex: 1, width: '100%', maxWidth: WEB_FRAME_MAX, overflow: 'hidden' },
});

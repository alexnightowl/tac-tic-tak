import { eos } from '@tac/core/tokens';
import type { ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

// On a wide browser window the app keeps its phone layout in a centred
// column (D35). Screens size themselves from useWindowDimensions(), so the
// window width they see is clamped to the column; height stays real.
export const WEB_FRAME_MAX = 600;

type Dims = { width: number; height: number; scale: number; fontScale: number };
const clamp = (d: Dims): Dims => (d.width > WEB_FRAME_MAX ? { ...d, width: WEB_FRAME_MAX } : d);

const rawGet = Dimensions.get.bind(Dimensions);
Dimensions.get = ((dim: 'window' | 'screen') => (dim === 'window' ? clamp(rawGet(dim)) : rawGet(dim))) as typeof Dimensions.get;

const rawAdd = Dimensions.addEventListener.bind(Dimensions);
const wrapped = new WeakMap<object, (e: { window: Dims; screen: Dims }) => void>();
Dimensions.addEventListener = ((type: 'change', handler: (e: { window: Dims; screen: Dims }) => void) => {
  const w = (e: { window: Dims; screen: Dims }) => handler({ ...e, window: clamp(e.window) });
  wrapped.set(handler, w);
  return rawAdd(type, w);
}) as typeof Dimensions.addEventListener;
// react-native-web's useWindowDimensions unsubscribes through removeEventListener.
const dimsWithRemove = Dimensions as unknown as { removeEventListener?: (t: string, h: object) => void };
const rawRemove = dimsWithRemove.removeEventListener?.bind(Dimensions);
if (rawRemove) {
  dimsWithRemove.removeEventListener = (type, handler) => rawRemove(type, wrapped.get(handler) ?? handler);
}

// Desktop affordances react-native-web leaves out: a hand over anything
// clickable, and no text selection when a button is clicked or dragged.
const CSS = `
[role="button"], [role="link"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"] {
  cursor: pointer; user-select: none; -webkit-user-select: none;
}
[aria-disabled="true"] { cursor: default; }
`;
if (typeof document !== 'undefined' && !document.getElementById('tt-web-css')) {
  const el = document.createElement('style');
  el.id = 'tt-web-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function WebFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.ground}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: eos.ink, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: WEB_FRAME_MAX, overflow: 'hidden' },
});

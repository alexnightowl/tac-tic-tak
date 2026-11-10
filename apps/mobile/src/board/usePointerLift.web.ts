import { useEffect, type RefObject } from 'react';
import type { HostInstance } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { DRAG_LIFT_SQ } from './constants';

/**
 * The lift above the finger keeps a touched piece visible; a mouse hides
 * nothing, and a lifted piece then lands a square off from where it is
 * seen (the drop goes by the pointer). Each press sets the lift by its
 * pointer, before the drag starts.
 */
export function usePointerLift(target: RefObject<HostInstance | null>, liftSq: SharedValue<number>): void {
  useEffect(() => {
    const el = target.current as unknown as HTMLElement | null;
    if (!el) return;
    const onDown = (e: PointerEvent) => liftSq.set(e.pointerType === 'mouse' ? 0 : DRAG_LIFT_SQ);
    el.addEventListener('pointerdown', onDown, true);
    return () => el.removeEventListener('pointerdown', onDown, true);
  });
}

import { xyToSquare, type Orientation, type Square } from '@tac/core/board';
import { useEffect, type RefObject } from 'react';
import type { HostInstance } from 'react-native';
import type { Drawing } from './drawing';

/**
 * The web's right-click drawing on the board element: press the right
 * button on a square and drag to another to draw an arrow (the same arrow
 * again removes it); release on the same square to mark it. The arrow
 * follows the pointer only over a square. Any left press clears the
 * drawing; the context menu is suppressed over the board. Moves stay with
 * the gesture handler, which never sees a right press.
 */
export function useMouseDrawing(
  target: RefObject<HostInstance | null>,
  drawing: Drawing,
  { size, orientation, mirror }: { size: number; orientation: Orientation; mirror: boolean },
): void {
  useEffect(() => {
    const el = target.current as unknown as HTMLElement | null;
    if (!el || !size) return;
    const squareOf = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return xyToSquare(e.clientX - r.left, e.clientY - r.top, size, orientation, mirror);
    };
    let from: Square | null = null;
    let to: Square | null = null;

    const onMove = (e: PointerEvent) => {
      if (!from) return;
      const s = squareOf(e);
      if (!s) return;
      to = s;
      drawing.setPending(to !== from ? { from, to } : null);
    };
    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      from = null;
      to = null;
    };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 2 || !from) return;
      if (to && to !== from) drawing.toggleArrow(from, to);
      else drawing.toggleMark(from);
      stop();
    };
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) {
        drawing.clear();
        return;
      }
      if (e.button !== 2) return;
      // The gesture handler would track this pointer too and, released off
      // the board, never see it end: the board then ignores the next clicks.
      e.stopPropagation();
      const s = squareOf(e);
      if (!s) return;
      e.preventDefault();
      stop();
      from = s;
      to = s;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    el.addEventListener('pointerdown', onDown, true);
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      stop();
      drawing.setPending(null);
      el.removeEventListener('pointerdown', onDown, true);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [target, drawing, size, orientation, mirror]);
}

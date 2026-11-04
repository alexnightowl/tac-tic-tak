'use client';

import * as Dialog from '@radix-ui/react-dialog';
import clsx from 'clsx';
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import './kit.css';

export type GrabberTone = 'seam' | 'ash' | 'glass' | 'light' | 'iron';

const GRABBER: Record<GrabberTone, string> = {
  seam: 'var(--surface-grabber)',
  ash: 'var(--surface-grabber-ash)',
  glass: 'var(--surface-grabber-glass)',
  light: 'var(--surface-grabber-light)',
  iron: 'var(--surface-grabber-iron)',
};

/** Drag distance (px) or downward velocity (px/s) that dismisses a sheet (app SHEET_DISMISS). */
const DISMISS = { distance: 80, velocity: 800 } as const;

/** Phone layout below this width; a centred dialog from it up (docs/web/PLAN.md §2). */
const DESKTOP = '(min-width: 768px)';

export type SheetMode = 'auto' | 'sheet' | 'dialog';

function subscribe(cb: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** 'sheet' below 768 px, 'dialog' above; `mode` other than 'auto' forces one. */
function useResolvedMode(mode: SheetMode): 'sheet' | 'dialog' {
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
  return mode === 'auto' ? (desktop ? 'dialog' : 'sheet') : mode;
}

/**
 * 36 × 5 sheet grabber. Inline (default) it sits centred with 8 px below
 * (confirm sheets); `floating` pins it 5 px from the top edge, centred.
 */
export function SheetGrabber({ tone = 'seam', floating = false }: { tone?: GrabberTone; floating?: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx('v2-grabber', floating ? 'v2-grabber--floating' : 'v2-grabber--inline')}
      style={{ background: GRABBER[tone] }}
    />
  );
}

/**
 * Drag-down-to-dismiss on the grabber strip (touch and pen; a mouse closes
 * with the backdrop or Escape). Moves the panel through its inline
 * transform, so nothing re-renders while dragging.
 */
function useDragDismiss(enabled: boolean, onClose: () => void) {
  const panel = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ y: number; t: number; dy: number; v: number } | null>(null);

  const set = (dy: number, animate: boolean) => {
    const el = panel.current;
    if (!el) return;
    el.style.transition = animate ? 'transform var(--t-sheet)' : 'none';
    el.style.transform = dy ? `translateY(${dy}px)` : '';
  };

  const handlers = enabled
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
          if (e.pointerType === 'mouse') return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, t: e.timeStamp, dy: 0, v: 0 };
        },
        onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
          const d = drag.current;
          if (!d) return;
          const raw = e.clientY - d.y;
          // Free downward, rubber-banded upward.
          const dy = raw > 0 ? raw : raw * 0.15;
          const dt = Math.max(1, e.timeStamp - d.t);
          d.v = ((dy - d.dy) / dt) * 1000;
          d.dy = dy;
          d.t = e.timeStamp;
          set(dy, false);
        },
        onPointerUp: () => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          if (d.dy > DISMISS.distance || d.v > DISMISS.velocity) onClose();
          else set(0, true);
        },
        onPointerCancel: () => {
          drag.current = null;
          set(0, true);
        },
      }
    : {};
  return { panel, handlers };
}

type PanelProps = {
  onClose: () => void;
  testID?: string;
  grabber?: boolean;
  dismissible?: boolean;
  mode?: SheetMode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * Bottom sheet over everything (Radix Dialog: portal, focus trap, Escape,
 * scroll lock). Design v2 confirm sheets (Reset, Exit, sound variant):
 * shade ground, radius 16 top corners, 1 px bone/4 % top rule, padding
 * 12/16 (20 without the grabber), gap 12; ink/70 backdrop fades in while the
 * panel slides up (200 ms ease-out). From 768 px wide it is a centred
 * dialog instead. The backdrop, Escape and a downward drag call `onClose`.
 */
export function Sheet({
  visible,
  onClose,
  testID,
  closeLabel,
  title,
  grabber = true,
  dismissible = true,
  mode = 'auto',
  children,
  className,
  style,
}: PanelProps & {
  visible: boolean;
  /** Label of the screen-reader close control ("Cancel" / "Keep playing"). */
  closeLabel: string;
  /** The dialog's accessible name (visually hidden; the content shows its own heading). */
  title: string;
}) {
  const resolved = useResolvedMode(mode);
  const { panel, handlers } = useDragDismiss(dismissible && resolved === 'sheet', onClose);
  const block = (e: Event) => {
    if (!dismissible) e.preventDefault();
  };
  return (
    <Dialog.Root
      open={visible}
      onOpenChange={(open) => {
        if (!open && dismissible) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="v2-sheet-backdrop" data-testid={testID ? `${testID}-backdrop` : undefined} />
        <Dialog.Content
          ref={panel}
          data-testid={testID}
          aria-describedby={undefined}
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
          // Focus the panel, not its first button (often the destructive one).
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            panel.current?.focus();
          }}
          className={clsx(
            'v2-sheet',
            `v2-sheet--${resolved}`,
            !grabber || resolved === 'dialog' ? 'v2-sheet--plain' : null,
            className,
          )}
          style={style}
        >
          <Dialog.Title className="v2-sr">{title}</Dialog.Title>
          {grabber && resolved === 'sheet' ? (
            <div className="v2-sheet-handle" {...handlers}>
              <SheetGrabber />
            </div>
          ) : null}
          {children}
          {dismissible ? <Dialog.Close className="v2-sr">{closeLabel}</Dialog.Close> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The sheet without the portal, for overlays that must stay inside a
 * screen (the runner's ExitSheet keeps the board mounted underneath).
 * Render it conditionally inside a positioned parent; it fills it.
 */
export function SheetBody({
  onClose,
  testID,
  closeLabel,
  title,
  grabber = true,
  dismissible = true,
  mode = 'auto',
  children,
  className,
  style,
  static: still = false,
}: PanelProps & {
  closeLabel: string;
  title?: string;
  /** Kit page only: no enter animation. */
  static?: boolean;
}) {
  const resolved = useResolvedMode(mode);
  const { panel, handlers } = useDragDismiss(dismissible && resolved === 'sheet', onClose);

  useEffect(() => {
    if (!dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissible, onClose]);

  return (
    <div style={{ position: 'absolute', inset: 0 }} data-testid={testID}>
      <button
        type="button"
        tabIndex={-1}
        aria-label={closeLabel}
        data-testid={testID ? `${testID}-backdrop` : undefined}
        onClick={dismissible ? onClose : undefined}
        className={clsx('v2-reset v2-sheet-backdrop v2-sheet-backdrop--local', still && 'v2-sheet--static')}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'v2-sheet v2-sheet--local',
          `v2-sheet--${resolved}`,
          !grabber || resolved === 'dialog' ? 'v2-sheet--plain' : null,
          still && 'v2-sheet--static',
          className,
        )}
        style={style}
      >
        {grabber && resolved === 'sheet' ? (
          <div className="v2-sheet-handle" {...handlers}>
            <SheetGrabber />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

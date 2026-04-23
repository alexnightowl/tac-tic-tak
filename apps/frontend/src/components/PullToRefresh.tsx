'use client';

import { useRef, useState, useEffect } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';

type Props = {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
};

/**
 * Mobile pull-to-refresh. Shows a small indicator at the top while the user
 * pulls down from the very top of the scroll container, triggers `onRefresh`
 * once the trigger distance is exceeded, then snaps back.
 *
 * Only engages when the window is scrolled to the top — otherwise we let the
 * native scroll behave.
 */
export function PullToRefresh({ onRefresh, children }: Props) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const TRIGGER = 72;
  const MAX = 110;

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return;
      if (e.touches.length !== 1) return;
      startY.current = e.touches[0].clientY;
      pulling.current = false;
    }
    function onTouchMove(e: TouchEvent) {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { setPullY(0); return; }
      if (window.scrollY > 0) return;
      pulling.current = true;
      // Rubber-band effect
      const rubber = Math.min(MAX, dy * 0.45);
      setPullY(rubber);
    }
    async function onTouchEnd() {
      if (!pulling.current) { setPullY(0); startY.current = null; return; }
      if (pullY >= TRIGGER && !refreshing) {
        setRefreshing(true);
        setPullY(TRIGGER);
        try { await onRefresh(); } finally {
          setRefreshing(false);
          setPullY(0);
        }
      } else {
        setPullY(0);
      }
      startY.current = null;
      pulling.current = false;
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullY, refreshing, onRefresh]);

  const showIndicator = pullY > 8 || refreshing;
  const progress = Math.min(1, pullY / TRIGGER);

  return (
    <>
      <div
        className="fixed left-0 right-0 flex items-center justify-center pointer-events-none z-50 transition-opacity"
        style={{
          top: 'max(8px, env(safe-area-inset-top))',
          opacity: showIndicator ? 1 : 0,
          transform: `translateY(${Math.max(0, pullY - 36)}px)`,
        }}
      >
        <div className="glass h-9 w-9 rounded-full flex items-center justify-center">
          {refreshing
            ? <Loader2 size={18} className="text-[var(--accent)] animate-spin" />
            : <ArrowDown
                size={16}
                className="text-[var(--accent)] transition-transform"
                style={{ transform: `rotate(${progress * 180}deg)` }}
              />}
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${pullY}px)`,
          transition: refreshing || pullY === 0 ? 'transform 180ms ease' : 'none',
        }}
      >
        {children}
      </div>
    </>
  );
}

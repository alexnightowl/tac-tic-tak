'use client';

import { fmtDuration } from '@tac/core/format';
import { warnThresholdSec } from '@tac/core/runner';
import { keyframes } from '@tac/core/tokens';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import { bezier } from '@/v2/board/constants';
import { feel } from '@/v2/feel';
import { useReducedMotion } from '@/v2/motion';
import { AppText } from '@/v2/ui';
import type { RunnerController } from './controller';
import './runner.css';

/** Last seconds with a tick each (FEEL_TABLE timerTick; haptic only on the app). */
const TICK_LAST_SEC = 5;

type Display = { sec: number; warn: boolean; paused: boolean; loading: boolean };

const same = (a: Display, b: Display) =>
  a.sec === b.sec && a.warn === b.warn && a.paused === b.paused && a.loading === b.loading;

/**
 * Port of apps/mobile/src/runner/Countdown.tsx: the session clock. It reads
 * the end time from the controller on its own timer, aligned to the next
 * whole second, and re-renders only itself, at most once a second. The
 * runner screen and the board never render on a tick. When the clock
 * reaches 0 it nudges the runner with a `tick` (a safety net for timers a
 * background tab delayed).
 */
export function Countdown({ controller, label }: { controller: RunnerController; label: string }) {
  const [display, setDisplay] = useState<Display>(() => read(controller));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let warned = false;
    let lastTick = -1;

    const sync = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      const now = Date.now();
      const next = read(controller, now);
      setDisplay((prev) => (same(prev, next) ? prev : next));
      const s = controller.state;
      const running = !s.paused && s.endsAt != null;
      if (!running) return;
      if (next.warn && !warned) {
        warned = true;
        feel.emit('timerWarning');
      }
      if (next.sec > 0 && next.sec <= TICK_LAST_SEC && next.sec !== lastTick) {
        lastTick = next.sec;
        feel.emit('timerTick');
      }
      const ms = controller.remainingMs(now);
      controller.persistTick();
      if (ms <= 0) {
        controller.dispatch({ type: 'tick' });
        return;
      }
      // Wake just after the displayed second changes (ceil display).
      const toNext = ms % 1000 || 1000;
      timer = setTimeout(sync, toNext + 5);
    };

    const unsub = controller.subscribe(sync);
    sync();
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [controller]);

  const { sec, warn, paused, loading } = display;
  const text = loading ? '--:--' : fmtDuration(sec);
  return (
    <div className={clsx('v2r-timer', warn && 'v2r-timer--warn')} role="timer" aria-label={label} aria-live="off">
      {warn && <PulseRing />}
      <AppText variant="timer" color={warn ? 'var(--eos-rose)' : paused ? 'var(--eos-ash)' : 'var(--eos-bone)'} testID="runner-timer">
        {text}
      </AppText>
    </div>
  );
}

function read(controller: RunnerController, now: number = Date.now()): Display {
  const s = controller.state;
  const sec = Math.max(0, Math.ceil(controller.remainingMs(now) / 1000));
  const running = !s.paused && s.endsAt != null;
  return {
    sec,
    paused: s.paused,
    loading: s.phase === 'booting',
    // web: red pill in the last 10–30 s, never while paused.
    warn: running && sec > 0 && sec <= warnThresholdSec(s.durationSec),
  };
}

/** .pulse-red: a red ring breathing out of the pill (static under reduced motion). */
function PulseRing() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const k = keyframes.pulseRed;
    const a = el.animate(
      [
        { opacity: 1, transform: 'scale(1, 1)' },
        { opacity: 0, transform: 'scale(1.12, 1.35)' },
      ],
      { duration: k.duration, easing: bezier(k.easing), iterations: Infinity },
    );
    return () => a.cancel();
  }, [reduced]);
  return <span ref={ref} className={clsx('v2r-timer-ring', reduced && 'v2r-timer-ring--static')} aria-hidden />;
}

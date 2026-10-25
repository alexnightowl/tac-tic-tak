import { fmtDuration } from '@tac/core/format';
import { warnThresholdSec } from '@tac/core/runner';
import { control, eos, keyframes, radii, semantic, space, surface, feedback } from '@tac/core/tokens';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { feel } from '@/feel';
import { AppText } from '@/ui';
import type { RunnerController } from './controller';

/** Last seconds with a Rigid tick each (FEEL_TABLE timerTick). */
const TICK_LAST_SEC = 5;

type Display = { sec: number; warn: boolean; paused: boolean; loading: boolean };

const same = (a: Display, b: Display) =>
  a.sec === b.sec && a.warn === b.warn && a.paused === b.paused && a.loading === b.loading;

/**
 * The session clock (PLAN §2.7). It reads the end time from the controller
 * on its own timer, aligned to the next whole second, and re-renders only
 * itself, at most once a second. The runner screen and the board never
 * render on a tick. When the clock reaches 0 it nudges the runner with a
 * `tick` (a safety net for timers delayed by the OS).
 */
export function Countdown({ controller, accessibilityLabel }: { controller: RunnerController; accessibilityLabel: string }) {
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
  return (
    <View
      style={[styles.pill, warn && styles.pillWarn]}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: loading ? '' : fmtDuration(sec) }}
    >
      {warn && <PulseRing />}
      <AppText variant="timer" color={warn ? eos.rose : paused ? eos.ash : eos.bone} testID="runner-timer">
        {loading ? '--:--' : fmtDuration(sec)}
      </AppText>
    </View>
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

/** web .pulse-red: a red ring breathing out of the pill (static under reduced motion). */
function PulseRing() {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    const k = keyframes.pulseRed;
    p.set(withRepeat(withTiming(1, { duration: k.duration, easing: Easing.bezier(...k.easing) }), -1, false));
    return () => cancelAnimation(p);
  }, [p, reduced]);
  const ring = useAnimatedStyle(() => ({
    opacity: reduced ? 0.6 : 1 - p.get(),
    transform: [{ scaleX: 1 + p.get() * 0.12 }, { scaleY: 1 + p.get() * 0.35 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.ring, ring]} />;
}

const styles = StyleSheet.create({
  pill: {
    minWidth: space[20],
    height: space[10],
    paddingHorizontal: space[4],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.floatCard,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
  },
  pillWarn: {
    backgroundColor: control.emberTint16,
    borderColor: control.dangerBorder,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: feedback.timerPulse,
  },
});

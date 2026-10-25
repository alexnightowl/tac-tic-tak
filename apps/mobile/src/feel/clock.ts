import { runOnUISync } from 'react-native-worklets';

// The UI runtime's performance.now() (worklets: raw steady_clock) and the RN
// runtime's (relative to its time origin) have different zeros. For the
// gesture → start() latency we map UI timestamps onto the JS clock with an
// offset measured by a synchronous round trip (error ≤ half the RTT; the
// tightest of a few tries is kept). Dev measurement only.

let offset: number | null = null;
let offsetErr = 0;

function uiNow(): number {
  'worklet';
  return performance.now();
}

function calibrate(): void {
  let best = Infinity;
  for (let i = 0; i < 7; i++) {
    const j0 = performance.now();
    const u = runOnUISync(uiNow);
    const j1 = performance.now();
    const rtt = j1 - j0;
    if (rtt < best) {
      best = rtt;
      offset = u - (j0 + j1) / 2;
    }
  }
  offsetErr = best / 2;
}

/** A UI-runtime performance.now() value expressed on the JS clock. */
export function uiTimeToJs(tUI: number): number {
  if (offset === null) calibrate();
  return tUI - (offset as number);
}

/** ± ms uncertainty of uiTimeToJs (half the best round trip). */
export function uiClockError(): number {
  if (offset === null) calibrate();
  return offsetErr;
}

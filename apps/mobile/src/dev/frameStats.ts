import { useCallback } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export type FrameReport = {
  frames: number;
  p50: number;
  p95: number;
  /** Share of frames slower than one 60 Hz frame / two 60 Hz frames. */
  over16: number;
  over33: number;
};

const MAX_SAMPLES = 20_000;

function summarise(deltas: number[]): FrameReport {
  if (deltas.length === 0) return { frames: 0, p50: 0, p95: 0, over16: 0, over33: 0 };
  const sorted = [...deltas].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const share = (ms: number) => deltas.filter((d) => d > ms).length / deltas.length;
  return { frames: deltas.length, p50: at(0.5), p95: at(0.95), over16: share(16.7), over33: share(33.4) };
}

/**
 * UI-thread frame-time sampler (PLAN §2.11 FrameStats). Deltas are recorded
 * inside a frame callback, so a busy JS thread doesn't hide UI-thread jank.
 * Only meaningful in Release builds.
 */
export function useFrameStats(onReport: (r: FrameReport) => void) {
  const deltas = useSharedValue<number[]>([]);
  const frame = useFrameCallback((info) => {
    'worklet';
    const dt = info.timeSincePreviousFrame;
    if (dt == null) return;
    const list = deltas.get();
    if (list.length < MAX_SAMPLES) list.push(dt);
  }, false);

  const start = useCallback(() => {
    deltas.set([]);
    frame.setActive(true);
  }, [deltas, frame]);

  const stop = useCallback(() => {
    frame.setActive(false);
    // Read the samples on the UI thread and hand a plain copy back to JS.
    const report = (list: number[]) => onReport(summarise(list));
    deltas.modify((list) => {
      'worklet';
      scheduleOnRN(report, list.slice());
      return list;
    });
  }, [deltas, frame, onReport]);

  return { start, stop };
}

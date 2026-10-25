import { hapticSteps, type HapticKind, type HapticSpec } from '@tac/core/feel';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { recordError } from './latency';
import { getFeelPrefs } from './prefs';

// Haptics facade over expo-haptics (PLAN §2.8 baseline). Pulsar may replace
// the engine behind this file later (ceremony / gate / castle patterns), never
// the call sites. expo-haptics has no amplitude control, so a step's
// `intensity` is not playable here; the per-event user scale instead mutes
// (0) or shifts an impact one step along the ladder below.

const IMPACT: Partial<Record<HapticKind, Haptics.ImpactFeedbackStyle>> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  rigid: Haptics.ImpactFeedbackStyle.Rigid,
  soft: Haptics.ImpactFeedbackStyle.Soft,
};

const NOTIFY: Partial<Record<HapticKind, Haptics.NotificationFeedbackType>> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

// Android: performHapticFeedback constants feel closer to iOS than the
// Vibrator-simulated impactAsync and need no VIBRATE permission. Untuned:
// verify on a device (the emulator has no vibrator).
const ANDROID: Record<HapticKind, Haptics.AndroidHaptics> = {
  selection: Haptics.AndroidHaptics.Segment_Tick,
  soft: Haptics.AndroidHaptics.Segment_Frequent_Tick,
  light: Haptics.AndroidHaptics.Clock_Tick,
  medium: Haptics.AndroidHaptics.Virtual_Key,
  rigid: Haptics.AndroidHaptics.Keyboard_Tap,
  heavy: Haptics.AndroidHaptics.Long_Press,
  success: Haptics.AndroidHaptics.Confirm,
  warning: Haptics.AndroidHaptics.Long_Press,
  error: Haptics.AndroidHaptics.Reject,
};

/** Impact strength ladder for the per-event scale (rigid keeps its character). */
const LADDER: HapticKind[] = ['soft', 'light', 'medium', 'heavy'];

function scaled(kind: HapticKind, scale: number): HapticKind {
  const i = LADDER.indexOf(kind);
  if (i < 0) return kind;
  const shift = scale < 0.5 ? -1 : scale >= 1.5 ? 1 : 0;
  return LADDER[Math.max(0, Math.min(LADDER.length - 1, i + shift))];
}

const onFail = (err: unknown) => recordError('haptic', err);

function fire(kind: HapticKind): void {
  // Re-checked per step so turning haptics off silences a running pattern.
  if (!getFeelPrefs().hapticsEnabled) return;
  try {
    if (Platform.OS === 'android') {
      Haptics.performAndroidHapticsAsync(ANDROID[kind]).catch(onFail);
      return;
    }
    if (kind === 'selection') {
      Haptics.selectionAsync().catch(onFail);
      return;
    }
    const impact = IMPACT[kind];
    if (impact) {
      Haptics.impactAsync(impact).catch(onFail);
      return;
    }
    const note = NOTIFY[kind];
    if (note) Haptics.notificationAsync(note).catch(onFail);
  } catch (err) {
    onFail(err);
  }
}

/**
 * Play a haptic now or as a timed pattern. Step 0 fires synchronously (same
 * frame as the sound); later steps use JS timers, which is fine at the
 * pattern gaps here (≥ 80 ms; the timer jitter is a few ms).
 */
export function playHaptic(spec: HapticSpec, scale = 1): void {
  if (scale <= 0 || !getFeelPrefs().hapticsEnabled) return;
  for (const step of hapticSteps(spec)) {
    const kind = scaled(step.haptic, scale);
    if (step.at <= 0) fire(kind);
    else setTimeout(() => fire(kind), step.at);
  }
}

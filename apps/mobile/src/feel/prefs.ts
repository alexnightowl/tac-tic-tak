import {
  DEFAULT_SOUND_PICKS,
  DEFAULT_SOUND_VOLUME,
  SOUND_PREFS_KEY,
  type FeelEvent,
  type SoundEvent,
} from '@tac/core/feel';
import { useSyncExternalStore } from 'react';

import { appKV, readJSON, writeJSON } from '@/platform/storage';

// Per-device feel prefs, read synchronously from MMKV `app` at import so the
// first sound after a cold start already uses the user's volume and picks.
// `taktic.soundPrefs` keeps the web's shape ({volume, picks}); the rest is
// mobile-only. soundEnabled belongs to the account settings (appStore, later
// phase), which mirrors it in here with setFeelPrefs({ soundEnabled }).

const FEEL_PREFS_KEY = 'taktic.feelPrefs';

export type FeelPrefs = {
  soundEnabled: boolean;
  /** 0..1, the web's per-device volume. */
  volume: number;
  picks: Record<SoundEvent, string>;
  hapticsEnabled: boolean;
  /**
   * Per-event haptic scale (default 1; 0 mutes that event's haptic). Tuned in
   * /dev/feel-lab and exported as JSON for docs/mobile/FEEL.md.
   */
  hapticScale: Partial<Record<FeelEvent, number>>;
};

type WebSoundPrefs = { volume?: number; picks?: Partial<Record<SoundEvent, string>> };
type MobileFeelPrefs = Partial<Pick<FeelPrefs, 'soundEnabled' | 'hapticsEnabled' | 'hapticScale'>>;

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

function load(): FeelPrefs {
  const web = readJSON<WebSoundPrefs>(appKV, SOUND_PREFS_KEY, {});
  const mob = readJSON<MobileFeelPrefs>(appKV, FEEL_PREFS_KEY, {});
  return {
    soundEnabled: mob.soundEnabled ?? true,
    volume: clamp01(web.volume, DEFAULT_SOUND_VOLUME),
    picks: { ...DEFAULT_SOUND_PICKS, ...(web.picks ?? {}) },
    hapticsEnabled: mob.hapticsEnabled ?? true,
    hapticScale: mob.hapticScale ?? {},
  };
}

let prefs: FeelPrefs = load();
const listeners = new Set<() => void>();

/** Synchronous snapshot; the emit path reads this, never a hook. */
export function getFeelPrefs(): FeelPrefs {
  return prefs;
}

export function setFeelPrefs(patch: Partial<FeelPrefs>): void {
  const next = { ...prefs, ...patch };
  if (patch.volume !== undefined) next.volume = clamp01(patch.volume, prefs.volume);
  prefs = next;
  writeJSON(appKV, SOUND_PREFS_KEY, { volume: next.volume, picks: next.picks });
  writeJSON(appKV, FEEL_PREFS_KEY, {
    soundEnabled: next.soundEnabled,
    hapticsEnabled: next.hapticsEnabled,
    hapticScale: next.hapticScale,
  });
  listeners.forEach((l) => l());
}

export function setHapticScale(event: FeelEvent, scale: number): void {
  const v = Math.max(0, Math.min(2, Math.round(scale * 100) / 100));
  setFeelPrefs({ hapticScale: { ...prefs.hapticScale, [event]: v } });
}

export function hapticScaleFor(event: FeelEvent): number {
  return prefs.hapticScale[event] ?? 1;
}

export function subscribeFeelPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For settings / lab screens only (re-renders on change). */
export function useFeelPrefs(): FeelPrefs {
  return useSyncExternalStore(subscribeFeelPrefs, getFeelPrefs, getFeelPrefs);
}

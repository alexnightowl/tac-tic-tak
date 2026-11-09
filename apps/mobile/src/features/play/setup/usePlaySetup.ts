import { STYLE_FORMULAS, type BandKey, type TrainingStyle } from '@tac/core/rules';
import { levelFor } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { useAppStore } from '@/stores/appStore';
import { useLang } from '@/ui';
import {
  clampDifficulty,
  clampMinutes,
  minuteRange,
  readLastStyle,
  resolveDurationFor,
  writeLastDuration,
  writeLastStyle,
  type SetupMode,
} from '../setupPrefs';
import { blindPreviewFor } from '../blind/store';
import { startSession, useThemePick } from '../startSession';
import { startErrorKey, usePlayT, type PlayT } from '../strings';

// The Play setup's state and actions (mode, style, duration, difficulty,
// Start), shared by the phone screen (PlaySetupScreen) and the desktop page
// (desktop/home DxPlay) so both start sessions the same way.

/** A difficulty pick is tied to the level it was made against. */
type Pick = { value: number; level: number };

/** Casual / Themes presets: this far either side of the level. */
export const PRESET_SPAN = 200;

export function usePlaySetup() {
  const t = usePlayT();
  const { lang } = useLang();
  const progressions = useAppStore((s) => s.progressions);
  const theme = useThemePick((s) => s.theme);

  // MMKV is synchronous: the stored picks are there on the first frame.
  const [style, setStyle] = useState<TrainingStyle>(readLastStyle);
  const [dur, setDur] = useState(() => resolveDurationFor(readLastStyle()));
  const [mode, setMode] = useState<SetupMode>('mixed');
  // /play?mode=theme&at=<stamp> (Stats theme row with nothing to review):
  // open in theme mode, once per request. Adjusted during render, not in
  // an effect, so the first frame already shows theme mode.
  const params = useLocalSearchParams<{ mode?: string; at?: string }>();
  const [seenAt, setSeenAt] = useState<string | undefined>(undefined);
  if (params.mode === 'theme' && params.at !== seenAt) {
    setSeenAt(params.at);
    setMode('theme');
  }
  const [pick, setPick] = useState<Pick | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [netErr, setNetErr] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Only a tap on Custom opens the number pad, not a restored custom pick. */
  const [focusCustom, setFocusCustom] = useState(false);

  const prog = progressions[style];
  // D39: the level is the player's only number; rated sessions start at it.
  const level = levelFor(prog);
  /** @deprecated D39: the internal in-session value; show `level` instead. */
  const rating = prog.currentPuzzleRating;
  const rated = mode === 'mixed';
  // The difficulty follows the level until the player picks one.
  const difficulty = clampDifficulty(pick && pick.level === level ? pick.value : level);
  const setDifficulty = (v: number) => setPick({ value: clampDifficulty(v), level });

  const live = useSharedValue(difficulty);
  useEffect(() => {
    live.set(difficulty);
  }, [live, difficulty]);

  const { min: minMinutes, max: maxMinutes } = minuteRange(style);
  const effectiveDuration = dur.custom ? clampMinutes(style, dur.customMinutes) * 60 : dur.duration;
  const customInvalid = dur.custom && dur.customMinutes === '';

  const bandLabels = {
    novice: t('levels.novice'),
    beginner: t('levels.beginner'),
    intermediate: t('levels.intermediate'),
    advanced: t('levels.advanced'),
    expert: t('levels.expert'),
  } satisfies Record<BandKey, string>;

  // In the handler, not an effect: style, difficulty and duration change in one render.
  const selectStyle = (next: TrainingStyle) => {
    if (next === style) return;
    setStyle(next);
    setPick(null);
    setDur(resolveDurationFor(next));
    writeLastStyle(next);
  };

  const selectDuration = (v: string) => {
    if (v === 'custom') {
      setDur((d) => ({ ...d, custom: true }));
      setFocusCustom(true);
      return;
    }
    const sec = Number(v);
    setDur({ duration: sec, custom: false, customMinutes: String(sec / 60) });
    writeLastDuration(style, sec);
  };

  const onMinutes = (v: string) => {
    if (v === '' || /^\d{1,2}$/.test(v)) setDur((d) => ({ ...d, customMinutes: v }));
  };

  // web onBlur: '' becomes the minimum, anything else its clamped value.
  const normaliseMinutes = () => {
    const m = clampMinutes(style, dur.customMinutes);
    setDur((d) => ({ ...d, customMinutes: String(m) }));
    writeLastDuration(style, m * 60);
  };

  const start = async () => {
    if (loading || customInvalid) return;
    setErr(null);
    setNetErr(false);
    setLoading(true);
    try {
      const id = await startSession({
        style,
        durationSec: effectiveDuration,
        mode,
        theme: mode === 'theme' ? theme : null,
        // Rated: the server starts it at the level whatever is sent.
        startRating: rated ? level : difficulty,
        blindPreviewSec: blindPreviewFor(mode),
      });
      router.push(`/play/${id}` as Href);
    } catch (e) {
      const key = startErrorKey(e);
      setErr(t(key));
      setNetErr(key === 'play.err_network');
    } finally {
      setLoading(false);
    }
  };

  const presets = STYLE_FORMULAS[style].durationPresetsSec;
  const cta = rated ? t('play.start_rated') : mode === 'casual' ? t('play.start_casual') : t('play.start_drill', { theme: themeLabel(theme, lang) });

  return {
    t,
    lang,
    theme,
    style,
    selectStyle,
    dur,
    selectDuration,
    onMinutes,
    normaliseMinutes,
    focusCustom,
    minMinutes,
    maxMinutes,
    presets,
    effectiveDuration,
    customInvalid,
    mode,
    setMode,
    rated,
    prog,
    level,
    rating,
    difficulty,
    setDifficulty,
    live,
    bandLabels,
    start,
    loading,
    err,
    netErr,
    cta,
  };
}

export type PlaySetup = ReturnType<typeof usePlaySetup>;

/** "+120 above your level" / "Your current level" (Casual / Themes note). */
export function diffDelta(delta: number, t: PlayT): string {
  if (delta === 0) return t('play.diff_same');
  return delta > 0 ? t('play.diff_above', { n: delta }) : t('play.diff_below', { n: -delta });
}

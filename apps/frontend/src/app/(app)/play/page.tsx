'use client';

import { createPortal } from 'react-dom';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore, type Progression } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Input } from '@/components/ui/input';
import { DifficultySlider } from '@/components/DifficultySlider';
import { StyleIcon } from '@/components/StyleIcon';
import { ThemePicker } from '@/components/ThemePicker';
import { stashFirstPuzzle, type FirstPuzzlePayload } from '@/lib/pending-puzzle';
import {
  bandFor, solvedTarget, BAND_ICON,
  STYLE_FORMULAS, TrainingStyle, TRAINING_STYLES, isTrainingStyle,
  DEFAULT_STYLE, UNLOCK_REWARD, CALIBRATION_SESSIONS,
} from '@/lib/levels';
import { cn } from '@/lib/utils';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Remember the player's last-played style so they don't have to
// re-pick on every visit. localStorage so it survives reloads but
// stays per-device — crossing devices is rare enough that the
// extra round-trip to a server-stored preference isn't worth it.
const LAST_STYLE_KEY = 'taktic.lastStyle';
// Last-picked duration is stored per-style: blitz/rapid/classical
// have different preset ranges, so a single global value would be
// wrong half the time. Shape: { [style]: seconds }.
const LAST_DURATIONS_KEY = 'taktic.lastDurations';

function readLastStyle(): TrainingStyle {
  if (typeof window === 'undefined') return DEFAULT_STYLE;
  try {
    const v = window.localStorage.getItem(LAST_STYLE_KEY);
    if (v && isTrainingStyle(v)) return v;
  } catch {}
  return DEFAULT_STYLE;
}

type StoredDurations = Partial<Record<TrainingStyle, number>>;

function readStoredDurations(): StoredDurations {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LAST_DURATIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as StoredDurations;
  } catch {}
  return {};
}

function writeStoredDuration(style: TrainingStyle, sec: number) {
  if (typeof window === 'undefined') return;
  try {
    const cur = readStoredDurations();
    cur[style] = sec;
    window.localStorage.setItem(LAST_DURATIONS_KEY, JSON.stringify(cur));
  } catch {}
}

// Where the rating slider opens for a style. Stable mode follows
// currentPuzzleRating up after a good session, but never below the
// rating the player picked for their last rated session — a rough
// session drags currentPuzzleRating down and would silently drop the
// next one into the comfort zone. During calibration the server picks
// the rating, so show that one.
function initialStartRating(p: Progression): number {
  if (p.calibrationSessionsLeft > 0) return p.currentPuzzleRating;
  return Math.min(Math.max(p.startPuzzleRating, p.currentPuzzleRating), p.unlockedStartRating + 200);
}

type DurationInit = { duration: number; customDuration: boolean; customMinutesSec: number };

function defaultDurationFor(style: TrainingStyle): DurationInit {
  const presets = STYLE_FORMULAS[style].durationPresetsSec;
  const fallback = presets[1] ?? presets[0];
  return { duration: fallback, customDuration: false, customMinutesSec: fallback };
}

function resolveDurationFor(style: TrainingStyle): DurationInit {
  const preset = STYLE_FORMULAS[style];
  const presets = preset.durationPresetsSec;
  const fallback = presets[1] ?? presets[0];
  const stored = readStoredDurations()[style];
  if (
    typeof stored !== 'number' ||
    !Number.isFinite(stored) ||
    stored < preset.minDurationSec ||
    stored > preset.maxDurationSec
  ) {
    return { duration: fallback, customDuration: false, customMinutesSec: fallback };
  }
  if (presets.includes(stored)) {
    return { duration: stored, customDuration: false, customMinutesSec: stored };
  }
  return { duration: fallback, customDuration: true, customMinutesSec: stored };
}

export default function PlaySetup() {
  const router = useRouter();
  const progressions = useAppStore((s) => s.progressions);
  const language = useAppStore((s) => s.settings.language);
  const t = useT();

  // First render uses the defaults on both server and client (reading
  // localStorage here broke hydration); the stored picks are applied in
  // a layout effect below, before the first paint.
  const [style, setStyle] = useState<TrainingStyle>(DEFAULT_STYLE);
  const stylePreset = STYLE_FORMULAS[style];
  const styleProgression = progressions[style];
  const unlocked = styleProgression.unlockedStartRating;
  // While the player still has calibration sessions left, the
  // displayed rating is provisional — surface a "?" badge next to
  // the number so the player knows it isn't yet a settled measure.
  const provisional = styleProgression.calibrationSessionsLeft > 0;

  const [startRating, setStartRatingRaw] = useState<number>(() => initialStartRating(styleProgression));
  // Until the player touches the slider, keep it in sync with the
  // progression — /users/me can land after the first render.
  const ratingTouched = useRef(false);
  const setStartRating = (v: number) => {
    ratingTouched.current = true;
    setStartRatingRaw(v);
  };
  useEffect(() => {
    if (!ratingTouched.current) setStartRatingRaw(initialStartRating(styleProgression));
  }, [styleProgression]);
  const [initialDuration] = useState<DurationInit>(() => defaultDurationFor(DEFAULT_STYLE));
  const [duration, setDuration] = useState<number>(initialDuration.duration);
  const [customDuration, setCustomDuration] = useState<boolean>(initialDuration.customDuration);
  const [customMinutes, setCustomMinutes] = useState<string>(String(Math.round(initialDuration.customMinutesSec / 60)));
  const [mode, setMode] = useState<'mixed' | 'theme'>('mixed');
  const [theme, setTheme] = useState('fork');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);

  useIsoLayoutEffect(() => {
    const last = readLastStyle();
    const d = resolveDurationFor(last);
    setStyle(last);
    setDuration(d.duration);
    setCustomDuration(d.customDuration);
    setCustomMinutes(String(Math.round(d.customMinutesSec / 60)));
    setRestored(true);
  }, []);

  // Theme sessions are unrated practice — no unlock cap, any rating is OK.
  // Mixed sessions stay capped at unlocked + 200 to prevent skipping
  // progression.
  const ratingCap = mode === 'theme' ? 3000 : unlocked + 200;

  // Stable-mode unlock requires the session to start within
  // DEMOTE_PEAK_BAND (50) of the unlocked ceiling. Anything below
  // that is a comfort-zone session: the cap can't move regardless
  // of how cleanly the player solves. Calibration sessions ignore
  // this gate (criteria-driven step from any startRating). Theme
  // sessions are unrated so the notice is irrelevant there too.
  const PEAK_BAND = 50;
  const peakFloor = unlocked - PEAK_BAND;
  const showComfortNotice =
    mode !== 'theme' && !provisional && startRating < peakFloor;
  // Last at-peak session was weak: one more drops the norm. Only a
  // suggestion — the slider stays wherever the player put it.
  const showOffForm =
    mode !== 'theme' && !provisional && styleProgression.weakSessionStreak > 0 && startRating >= peakFloor;
  const offFormRating = Math.max(400, Math.floor((peakFloor - 25) / 25) * 25);

  // When style changes, snap the rating + duration into that style's range
  // so users don't end up with nonsensical combos from the previous style.
  // Restore the last duration the player picked for this style if any.
  // Also pin the new pick to localStorage so the next visit pre-selects it.
  // Done in the click handler (not an effect) so style, rating and
  // duration change in ONE render — an effect would paint a frame with the
  // new style but the previous style's rating/duration first.
  const selectStyle = (next: TrainingStyle) => {
    if (next === style) return;
    setStyle(next);
    ratingTouched.current = false;
    setStartRatingRaw(initialStartRating(progressions[next]));
    const restored = resolveDurationFor(next);
    setDuration(restored.duration);
    setCustomDuration(restored.customDuration);
    setCustomMinutes(String(Math.round(restored.customMinutesSec / 60)));
    try { window.localStorage.setItem(LAST_STYLE_KEY, next); } catch {}
  };

  const selectedBand = bandFor(startRating);
  const bandLabels = {
    novice: t('levels.novice'),
    beginner: t('levels.beginner'),
    intermediate: t('levels.intermediate'),
    advanced: t('levels.advanced'),
    expert: t('levels.expert'),
  } as const;

  const minMinutes = Math.round(stylePreset.minDurationSec / 60);
  const maxMinutes = Math.round(stylePreset.maxDurationSec / 60);
  const customMinutesNum = Math.max(minMinutes, Math.min(maxMinutes, Math.floor(Number(customMinutes) || 0)));
  const effectiveDuration = customDuration ? customMinutesNum * 60 : duration;
  const customInvalid = customDuration && (customMinutes === '' || customMinutesNum < minMinutes);

  // Persist the current duration per-style so the next visit pre-selects it.
  // We save the clamped effective seconds; reconstruction handles preset vs
  // custom on the next read.
  useEffect(() => {
    // Not before the stored picks are restored — the default would
    // overwrite them.
    if (restored) writeStoredDuration(style, effectiveDuration);
  }, [restored, style, effectiveDuration]);

  const start = async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await http.post<{
        sessionId: string;
        firstPuzzle: FirstPuzzlePayload | null;
      }>('/sessions', {
        startRating,
        durationSec: effectiveDuration,
        mode,
        style,
        theme: mode === 'theme' ? theme : undefined,
      });
      // Hand the first puzzle off to the runner via an in-memory cache —
      // avoids the second /next round-trip that used to stall the board
      // on first load.
      if (r.firstPuzzle) stashFirstPuzzle(r.sessionId, r.firstPuzzle);
      router.push(`/play/${r.sessionId}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const ctaDisabled = loading || customInvalid || (mode === 'theme' && !theme);
  const ctaButton = (
    <Button
      className="w-full"
      size="lg"
      onClick={start}
      disabled={ctaDisabled}
    >
      <Play size={18} /> {loading ? t('play.starting') : t('play.start')}
    </Button>
  );

  return (
    <div className="max-w-md mx-auto space-y-5 pb-12 md:pb-0">
      <h1 className="text-center text-[20px] text-eos-bone">{t('play.new_session')}</h1>

      <Card className="space-y-6">
        <section>
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-eos-ash mb-2.5">{t('play.style')}</div>
          <Segmented
            value={style}
            onChange={(v) => selectStyle(v as TrainingStyle)}
            options={TRAINING_STYLES.map((s) => {
              const left = progressions[s]?.calibrationSessionsLeft ?? 0;
              const calibrating = left > 0;
              const done = CALIBRATION_SESSIONS - left;
              return {
                value: s,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <StyleIcon style={s} size={18} />
                    {t(`style.${s}.name`)}
                    {calibrating && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-[10px] font-semibold leading-none rounded-full px-1.5 py-0.5 tabular-nums',
                          s === style
                            ? 'bg-black/20 text-[#f5eee5]/85'
                            : 'bg-[rgba(215,183,119,0.15)] text-[#d7b777]',
                        )}
                        aria-label={t('play.calibration_progress_aria')
                          .replace('{done}', String(done))
                          .replace('{total}', String(CALIBRATION_SESSIONS))}
                      >
                        ?{done}/{CALIBRATION_SESSIONS}
                      </span>
                    )}
                  </span>
                ),
              };
            })}
          />
          <StyleBlurb style={style} t={t} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-eos-ash">
              {t(`style.${style}.rating_label`)}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="inline-flex items-center gap-1.5 self-center text-[10px] uppercase tracking-[0.12em] font-bold text-eos-ash">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={BAND_ICON[selectedBand.key]} alt="" width={18} height={18} className="h-[18px] w-[18px]" />
                {bandLabels[selectedBand.key]}
              </span>
              <span
                className="tabular-nums text-[22px] font-extrabold text-eos-bone"
                title={provisional ? t('play.rating_provisional') : undefined}
              >
                {startRating}
                {provisional && (
                  <span className="text-[#d7b777] ml-0.5">
                    ?
                  </span>
                )}
              </span>
            </div>
          </div>
          {/* Rating picker is hidden during calibration in mixed mode:
              the system controls the rating until the provisional
              window closes. The slider stays visible in theme mode
              (unrated practice — any rating is fine). */}
          {provisional && mode !== 'theme' ? (
            <p className="text-xs text-[#d7b777]/80 mt-2 leading-snug">
              {t('play.calibration_per_style')
                .replace('{done}', String(CALIBRATION_SESSIONS - styleProgression.calibrationSessionsLeft))
                .replace('{total}', String(CALIBRATION_SESSIONS))
                .replace('{style}', t(`style.${style}.name`).toLowerCase())}
            </p>
          ) : (
            <>
              <DifficultySlider
                value={startRating}
                onChange={setStartRating}
                cap={ratingCap}
                labels={bandLabels}
                currentRating={styleProgression.currentPuzzleRating}
                ariaLabel={t('play.start_rating')}
                levelUpFrom={mode !== 'theme' ? peakFloor : undefined}
                norm={mode !== 'theme' ? unlocked : undefined}
              />
              {mode !== 'theme' && (
                <div className="mt-2 flex items-center gap-4 text-[11px] text-eos-ash">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-4 rounded-full bg-[#6f6a6e]" aria-hidden />
                    {t('play.zone_comfort')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-4 rounded-full bg-[#a64241] shadow-[0_0_0_1px_rgba(215,183,119,0.45)]" aria-hidden />
                    {t('play.zone_levelup')}
                  </span>
                </div>
              )}
              <p className="text-xs text-zinc-500 mt-2">
                {mode === 'theme' ? (
                  <span className="text-zinc-400">{t('play.theme_unrated_hint')}</span>
                ) : (
                  <>
                    {t('play.unlocked')}: <span className="text-zinc-300">{unlocked}</span>
                    <span className="mx-2 text-zinc-700">·</span>
                    {t('play.cap')}: <span className="text-zinc-300">{ratingCap}</span>
                  </>
                )}
              </p>
              {showOffForm && (
                <div className="mt-3 rounded-xl p-3 border border-amber-500/40 bg-amber-500/10">
                  <div className="text-sm font-semibold text-[#d7b777]">{t('play.off_form_title')}</div>
                  <p className="text-xs text-zinc-300 mt-0.5 leading-snug">
                    {t('play.off_form_hint').replace('{floor}', String(peakFloor))}
                  </p>
                  <button
                    type="button"
                    onClick={() => setStartRating(offFormRating)}
                    className="mt-2 h-8 px-3 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 active:bg-amber-500/30 transition-colors text-xs font-semibold"
                  >
                    {t('play.off_form_cta').replace('{rating}', String(offFormRating))}
                  </button>
                </div>
              )}
              {showComfortNotice && (
                <p className="text-xs text-[#d7b777]/80 mt-2 leading-snug">
                  {t('play.comfort_notice').replace('{floor}', String(peakFloor))}
                </p>
              )}
            </>
          )}
        </section>

        <section>
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-eos-ash mb-2.5">{t('play.duration')}</div>
          <Segmented
            value={customDuration ? 'custom' : String(duration)}
            onChange={(v) => {
              if (v === 'custom') setCustomDuration(true);
              else { setCustomDuration(false); setDuration(Number(v)); }
            }}
            options={[
              ...stylePreset.durationPresetsSec.map((d) => ({
                value: String(d),
                label: `${d / 60} ${t('play.minutes')}`,
              })),
              { value: 'custom', label: t('play.custom') },
            ]}
          />
          {customDuration && (
            <div className="flex items-center gap-2 mt-3">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customMinutes}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d{1,2}$/.test(v)) setCustomMinutes(v);
                }}
                onBlur={() => {
                  if (customMinutes === '') setCustomMinutes(String(minMinutes));
                  else setCustomMinutes(String(customMinutesNum));
                }}
                className="max-w-[120px]"
              />
              <span className="text-sm text-zinc-400">
                {t('play.minutes')} · {minMinutes}–{maxMinutes}
              </span>
            </div>
          )}
        </section>

        <section>
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-eos-ash mb-2.5">{t('play.mode')}</div>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'mixed', label: t('play.mode.mixed') },
              { value: 'theme', label: t('play.mode.theme') },
            ]}
          />
          {mode === 'theme' && (
            <div className="mt-3">
              <ThemePicker value={theme} onChange={setTheme} />
            </div>
          )}
        </section>

        {mode === 'mixed' ? (
          provisional ? (
            <CalibrationPreview
              done={CALIBRATION_SESSIONS - styleProgression.calibrationSessionsLeft}
              total={CALIBRATION_SESSIONS}
              style={style}
              t={t}
            />
          ) : (
            <NextUnlockPreview
              style={style}
              durationSec={effectiveDuration}
              unlockedTo={unlocked}
              t={t}
            />
          )
        ) : (
          <ThemePracticeNote t={t} />
        )}

        {err && <p className="text-sm text-eos-rose">{err}</p>}

        {/* Desktop CTA — inline at the end of the Card. Mobile gets a
            full-width fixed bar below; this branch is hidden on phones
            so the button doesn't appear twice. */}
        <div className="hidden md:block">{ctaButton}</div>
      </Card>

      <MobileStartBar disabled={ctaDisabled}>{ctaButton}</MobileStartBar>
    </div>
  );
}

/**
 * Fixed full-width bottom CTA strip for mobile only. Rendered via a
 * portal into document.body so it isn't trapped by the PullToRefresh
 * wrapper's `transform` (a transformed ancestor changes the containing
 * block for fixed children — without the portal the bar would anchor
 * to the wrapper instead of the viewport and float at the wrong y).
 */
function MobileStartBar({ children, disabled }: { children: React.ReactNode; disabled: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div
      className="md:hidden fixed inset-x-0 z-30 pt-5 pb-2 pointer-events-none"
      style={{
        bottom: 'calc(58px + env(safe-area-inset-bottom))',
        background:
          'linear-gradient(to top, color-mix(in srgb, var(--accent) 10%, var(--bg-base)) 0%, color-mix(in srgb, var(--accent) 6%, var(--bg-base)) 55%, color-mix(in srgb, var(--bg-base) 75%, transparent) 80%, transparent 100%)',
      }}
      aria-hidden={disabled}
    >
      <div className="max-w-md mx-auto px-4 pointer-events-auto">{children}</div>
    </div>,
    document.body,
  );
}

function StyleBlurb({ style, t }: { style: TrainingStyle; t: (k: string) => string }) {
  const preset = STYLE_FORMULAS[style];
  const minMinutes = Math.round(preset.minDurationSec / 60);
  const maxMinutes = Math.round(preset.maxDurationSec / 60);
  return (
    <div className="mt-3 flex items-start gap-3 rounded-xl bg-black/20 px-3 py-2.5">
      <div
        className="h-8 w-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0"
        aria-hidden
      >
        <StyleIcon style={style} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-zinc-300 leading-snug">{t(`style.${style}.desc`)}</div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 tabular-nums">
          {minMinutes}–{maxMinutes} {t('play.minutes')}
        </div>
      </div>
    </div>
  );
}

function NextUnlockPreview({ style, durationSec, unlockedTo, t }: {
  style: TrainingStyle;
  durationSec: number;
  unlockedTo: number;
  t: (k: string) => string;
}) {
  const preset = STYLE_FORMULAS[style];
  const target = solvedTarget(style, durationSec);
  const accPct = Math.round(preset.accuracy * 100);

  return (
    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-softer)]/40 p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div className="text-xs uppercase tracking-wider text-zinc-400">
          {t('unlock.next_title')}
        </div>
        <div className="tabular-nums text-sm text-zinc-300">
          <span className="text-zinc-500">{unlockedTo}</span>
          <span className="mx-1 text-zinc-600">→</span>
          <span className="text-[var(--accent)] font-semibold">
            {unlockedTo + UNLOCK_REWARD}
          </span>
        </div>
      </div>
      <ul className="grid grid-cols-3 gap-2 text-xs">
        <Requirement label={t('unlock.req_solved')} value={`≥ ${target}`} />
        <Requirement label={t('unlock.req_accuracy')} value={`≥ ${accPct}%`} />
        <Requirement label={t('unlock.req_peak')} value={`+${preset.peakDelta}`} />
      </ul>
      <p className="text-[11px] text-zinc-500 mt-3 leading-snug">
        {t('unlock.hint')}
      </p>
    </section>
  );
}

/**
 * Mirror of NextUnlockPreview's card shell, shown during the
 * provisional period in place of the level-up criteria preview.
 * Same outer styling so the form layout doesn't reflow when
 * calibration ends and the level-up card replaces this one.
 */
function CalibrationPreview({ done, total, style, t }: {
  done: number;
  total: number;
  style: TrainingStyle;
  t: (k: string) => string;
}) {
  const pct = Math.round((done / total) * 100);
  return (
    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-softer)]/40 p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div className="text-xs uppercase tracking-wider text-zinc-400">
          {t('calibration.preview_title')}
        </div>
        <div className="tabular-nums text-sm text-zinc-300">
          <span className="text-[#d7b777] font-semibold">{done}</span>
          <span className="mx-1 text-zinc-600">/</span>
          <span className="text-zinc-400">{total}</span>
        </div>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-amber-400/80 transition-[width] duration-300"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <p className="text-[11px] text-zinc-500 mt-3 leading-snug">
        {t('calibration.preview_hint').replace('{style}', t(`style.${style}.name`).toLowerCase())}
      </p>
    </section>
  );
}

function ThemePracticeNote({ t }: { t: (k: string) => string }) {
  return (
    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-softer)]/40 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-400 mb-1.5">
        {t('play.theme_practice_title')}
      </div>
      <p className="text-[12px] text-zinc-400 leading-snug">
        {t('play.theme_practice_hint')}
      </p>
    </section>
  );
}

function Requirement({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-lg bg-black/20 px-2.5 py-2 flex flex-col items-center gap-0.5 text-center">
      <span className="text-zinc-400 leading-tight">{label}</span>
      <span className="tabular-nums font-semibold text-white leading-tight">{value}</span>
    </li>
  );
}

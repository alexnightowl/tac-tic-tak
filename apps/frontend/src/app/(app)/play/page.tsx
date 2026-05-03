'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Swords } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DifficultySlider } from '@/components/DifficultySlider';
import { StyleIcon } from '@/components/StyleIcon';
import { KNOWN_THEME_SLUGS, themeLabel } from '@/lib/theme-labels';
import { stashFirstPuzzle, type FirstPuzzlePayload } from '@/lib/pending-puzzle';
import {
  bandFor, solvedTarget,
  STYLE_FORMULAS, TrainingStyle, TRAINING_STYLES, isTrainingStyle,
  DEFAULT_STYLE, UNLOCK_REWARD, CALIBRATION_SESSIONS,
} from '@/lib/levels';
import { cn } from '@/lib/utils';

// Remember the player's last-played style so they don't have to
// re-pick on every visit. localStorage so it survives reloads but
// stays per-device — crossing devices is rare enough that the
// extra round-trip to a server-stored preference isn't worth it.
const LAST_STYLE_KEY = 'taktic.lastStyle';

function readLastStyle(): TrainingStyle {
  if (typeof window === 'undefined') return DEFAULT_STYLE;
  try {
    const v = window.localStorage.getItem(LAST_STYLE_KEY);
    if (v && isTrainingStyle(v)) return v;
  } catch {}
  return DEFAULT_STYLE;
}

export default function PlaySetup() {
  const router = useRouter();
  const progressions = useAppStore((s) => s.progressions);
  const language = useAppStore((s) => s.settings.language);
  const t = useT();

  const [style, setStyle] = useState<TrainingStyle>(readLastStyle);
  const stylePreset = STYLE_FORMULAS[style];
  const styleProgression = progressions[style];
  const unlocked = styleProgression.unlockedStartRating;
  // While the player still has calibration sessions left, the
  // displayed rating is provisional — surface a "?" badge next to
  // the number so the player knows it isn't yet a settled measure.
  const provisional = styleProgression.calibrationSessionsLeft > 0;

  const [startRating, setStartRating] = useState<number>(styleProgression.currentPuzzleRating);
  const [duration, setDuration] = useState<number>(stylePreset.durationPresetsSec[1] ?? stylePreset.durationPresetsSec[0]);
  const [customDuration, setCustomDuration] = useState<boolean>(false);
  const [customMinutes, setCustomMinutes] = useState<string>(String(Math.round((stylePreset.durationPresetsSec[1] ?? stylePreset.durationPresetsSec[0]) / 60)));
  const [mode, setMode] = useState<'mixed' | 'theme'>('mixed');
  const [theme, setTheme] = useState('fork');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  // When style changes, snap the rating + duration into that style's range
  // so users don't end up with nonsensical combos from the previous style.
  // Also pin the new pick to localStorage so the next visit pre-selects it.
  useEffect(() => {
    setStartRating(styleProgression.currentPuzzleRating);
    const presets = stylePreset.durationPresetsSec;
    setDuration(presets[1] ?? presets[0]);
    setCustomDuration(false);
    setCustomMinutes(String(Math.round((presets[1] ?? presets[0]) / 60)));
    try { window.localStorage.setItem(LAST_STYLE_KEY, style); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  const selectedBand = bandFor(startRating);
  const bandLabels = {
    novice: t('levels.novice'),
    beginner: t('levels.beginner'),
    intermediate: t('levels.intermediate'),
    advanced: t('levels.advanced'),
    expert: t('levels.expert'),
  } as const;

  const themeOptions = useMemo(
    () => KNOWN_THEME_SLUGS
      .map((slug) => ({ value: slug, label: themeLabel(slug, language as 'en' | 'uk') }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [language],
  );

  const minMinutes = Math.round(stylePreset.minDurationSec / 60);
  const maxMinutes = Math.round(stylePreset.maxDurationSec / 60);
  const customMinutesNum = Math.max(minMinutes, Math.min(maxMinutes, Math.floor(Number(customMinutes) || 0)));
  const effectiveDuration = customDuration ? customMinutesNum * 60 : duration;
  const customInvalid = customDuration && (customMinutes === '' || customMinutesNum < minMinutes);

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

  return (
    <div className="max-w-md mx-auto space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t('play.new_session')}</h1>

      <Card className="space-y-6">
        <section>
          <div className="text-sm text-zinc-300 mb-2">{t('play.style')}</div>
          <Segmented
            value={style}
            onChange={(v) => setStyle(v as TrainingStyle)}
            options={TRAINING_STYLES.map((s) => {
              const left = progressions[s]?.calibrationSessionsLeft ?? 0;
              const calibrating = left > 0;
              const done = CALIBRATION_SESSIONS - left;
              return {
                value: s,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    {t(`style.${s}.name`)}
                    {calibrating && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-[10px] font-semibold leading-none rounded-full px-1.5 py-0.5 tabular-nums',
                          s === style
                            ? 'bg-black/15 text-[var(--accent-contrast)]/85'
                            : 'bg-amber-400/15 text-amber-200',
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
            <div className="text-sm text-zinc-300">
              {t(`style.${style}.rating_label`)}
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-[10px] uppercase tracking-wider font-medium"
                style={{ color: selectedBand.color }}
              >
                {bandLabels[selectedBand.key]}
              </span>
              <span
                className="tabular-nums text-lg font-semibold text-white"
                title={provisional ? t('play.rating_provisional') : undefined}
              >
                {startRating}
                {provisional && (
                  <span className="text-amber-300 ml-0.5">
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
            <p className="text-xs text-amber-300/80 mt-2 leading-snug">
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
              />
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
              {showComfortNotice && (
                <p className="text-xs text-amber-300/80 mt-2 leading-snug">
                  {t('play.comfort_notice').replace('{floor}', String(peakFloor))}
                </p>
              )}
            </>
          )}
        </section>

        <section>
          <div className="text-sm text-zinc-300 mb-2">{t('play.duration')}</div>
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
          <div className="text-sm text-zinc-300 mb-2">{t('play.mode')}</div>
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
              <Select
                value={theme}
                onChange={setTheme}
                options={themeOptions}
                placeholder={t('play.choose_theme')}
                searchPlaceholder={t('play.search_themes')}
                noResultsLabel={t('play.no_themes_match')}
              />
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

        {err && <p className="text-sm text-red-400">{err}</p>}

        <Button
          className="w-full"
          size="lg"
          onClick={start}
          disabled={loading || customInvalid || (mode === 'theme' && !theme)}
        >
          <Swords size={18} /> {loading ? t('play.starting') : t('play.start')}
        </Button>
      </Card>
    </div>
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
          {minMinutes}–{maxMinutes} {t('play.minutes')} · ≤ {Math.round(preset.avgMs / 1000)}s {t('unlock.req_speed').toLowerCase()}
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
  const avgSec = Math.round(preset.avgMs / 1000);

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
      <ul className="grid grid-cols-2 gap-2 text-xs">
        <Requirement label={t('unlock.req_solved')} value={`≥ ${target}`} />
        <Requirement label={t('unlock.req_accuracy')} value={`≥ ${accPct}%`} />
        <Requirement label={t('unlock.req_speed')} value={`≤ ${avgSec}s`} />
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
          <span className="text-amber-300 font-semibold">{done}</span>
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
    <li className="rounded-lg bg-black/20 px-2.5 py-2 flex items-center justify-between gap-2">
      <span className="text-zinc-400">{label}</span>
      <span className="tabular-nums font-semibold text-white">{value}</span>
    </li>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Swords, Check, X } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DifficultySlider } from '@/components/DifficultySlider';
import { KNOWN_THEME_SLUGS, themeLabel } from '@/lib/theme-labels';
import {
  bandFor, solvedTarget,
  UNLOCK_ACCURACY, UNLOCK_AVG_MS, UNLOCK_DELTA, UNLOCK_REWARD,
} from '@/lib/levels';
import { cn } from '@/lib/utils';

const PRESET_DURATIONS = [300, 600, 1200];

export default function PlaySetup() {
  const router = useRouter();
  const progression = useAppStore((s) => s.progression);
  const unlocked = progression?.unlockedStartRating ?? 1200;
  const t = useT();

  const [startRating, setStartRating] = useState<number>(progression?.currentPuzzleRating ?? 1200);
  const [duration, setDuration] = useState<number>(600);
  const [customDuration, setCustomDuration] = useState<boolean>(false);
  const [customMinutes, setCustomMinutes] = useState<string>('15');
  const [mode, setMode] = useState<'mixed' | 'theme'>('mixed');
  const [theme, setTheme] = useState('fork');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ratingCap = unlocked + 200;
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
      .map((slug) => ({ value: slug, label: themeLabel(slug) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  const customMinutesNum = Math.max(1, Math.min(60, Math.floor(Number(customMinutes) || 0)));
  const effectiveDuration = customDuration ? customMinutesNum * 60 : duration;
  const customInvalid = customDuration && (customMinutes === '' || customMinutesNum < 1);

  const start = async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await http.post<{ sessionId: string }>('/sessions', {
        startRating,
        durationSec: effectiveDuration,
        mode,
        theme: mode === 'theme' ? theme : undefined,
      });
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
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-zinc-300">{t('play.start_rating')}</div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-[10px] uppercase tracking-wider font-medium"
                style={{ color: selectedBand.color }}
              >
                {bandLabels[selectedBand.key]}
              </span>
              <span className="tabular-nums text-lg font-semibold text-white">{startRating}</span>
            </div>
          </div>
          <DifficultySlider
            value={startRating}
            onChange={setStartRating}
            cap={ratingCap}
            labels={bandLabels}
            currentRating={progression?.currentPuzzleRating}
            ariaLabel={t('play.start_rating')}
          />
          <p className="text-xs text-zinc-500 mt-2">
            {t('play.unlocked')}: <span className="text-zinc-300">{unlocked}</span>
            <span className="mx-2 text-zinc-700">·</span>
            {t('play.cap')}: <span className="text-zinc-300">{ratingCap}</span>
          </p>
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
              ...PRESET_DURATIONS.map((d) => ({ value: String(d), label: `${d / 60} ${t('play.minutes')}` })),
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
                  // Allow empty (so the user can clear the field) or 1-2 digits.
                  if (v === '' || /^\d{1,2}$/.test(v)) setCustomMinutes(v);
                }}
                onBlur={() => {
                  // Clamp on blur so the final value is always 1-60.
                  if (customMinutes === '') setCustomMinutes('15');
                  else setCustomMinutes(String(customMinutesNum));
                }}
                className="max-w-[120px]"
              />
              <span className="text-sm text-zinc-400">{t('play.minutes')}</span>
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
              />
            </div>
          )}
        </section>

        <NextUnlockPreview
          durationSec={effectiveDuration}
          unlockedTo={unlocked}
          t={t}
        />

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

function NextUnlockPreview({ durationSec, unlockedTo, t }: {
  durationSec: number; unlockedTo: number; t: (k: string) => string;
}) {
  const target = solvedTarget(durationSec);
  const accPct = Math.round(UNLOCK_ACCURACY * 100);
  const avgSec = Math.round(UNLOCK_AVG_MS / 1000);

  return (
    <section
      className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-softer)]/40 p-4"
    >
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
        <Requirement label={t('unlock.req_peak')} value={`+${UNLOCK_DELTA}`} />
      </ul>
      <p className="text-[11px] text-zinc-500 mt-3 leading-snug">
        {t('unlock.hint')}
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

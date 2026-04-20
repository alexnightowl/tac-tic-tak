'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Swords } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { KNOWN_THEME_SLUGS, themeLabel } from '@/lib/theme-labels';

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

  const ratingMax = unlocked + 200;
  const ratingMin = 400;
  const ratingTicks = useMemo(() => {
    const out: number[] = [];
    const step = 200;
    for (let v = 400; v <= ratingMax; v += step) out.push(v);
    return out;
  }, [ratingMax]);

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
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-zinc-300">{t('play.start_rating')}</div>
            <div className="tabular-nums text-lg font-semibold text-white">{startRating}</div>
          </div>
          <Slider
            min={ratingMin}
            max={ratingMax}
            step={25}
            value={startRating}
            onChange={setStartRating}
            ticks={ratingTicks}
            aria-label={t('play.start_rating')}
          />
          <p className="text-xs text-zinc-500 mt-2">{t('play.unlocked')}: {unlocked}</p>
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

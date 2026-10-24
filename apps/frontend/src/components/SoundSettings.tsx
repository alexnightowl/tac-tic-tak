'use client';

import { Play } from 'lucide-react';
import { SOUND_CATALOG, SOUND_EVENT_ORDER } from '@/lib/sound/catalog';
import { sfx, stopLongClip, useSoundPrefs } from '@/lib/sound';
import { useT } from '@/lib/i18n';

/** Settings → Gameplay → Sounds: volume and one variant per event, with preview. */
export function SoundSettings() {
  const t = useT();
  const volume = useSoundPrefs((s) => s.volume);
  const picks = useSoundPrefs((s) => s.picks);
  const setVolume = useSoundPrefs((s) => s.setVolume);
  const pick = useSoundPrefs((s) => s.pick);

  return (
    <div className="space-y-3 pt-2">
      <div>
        <div className="text-sm">{t('settings.sound_section')}</div>
        <div className="text-xs text-zinc-500">{t('settings.sound_section_hint')}</div>
      </div>

      <label className="flex items-center gap-3 text-xs text-eos-ash">
        <span className="w-16 shrink-0">{t('settings.sound_volume')}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          className="flex-1 accent-[#a64241]"
          aria-label={t('settings.sound_volume')}
        />
        <span className="w-9 text-right tabular-nums">{Math.round(volume * 100)}%</span>
      </label>

      <ul className="divide-y divide-eos-rise rounded-lg bg-black/20">
        {SOUND_EVENT_ORDER.map((ev) => {
          const list = SOUND_CATALOG[ev];
          const current = picks[ev];
          const id = `snd-${ev}`;
          return (
            <li key={ev} className="flex items-center gap-2 px-3 py-2">
              <label htmlFor={id} className="flex-1 min-w-0 truncate text-sm text-eos-bone">
                {t(`sound.ev.${ev}`)}
              </label>
              {list.length > 1 ? (
                <select
                  id={id}
                  value={current}
                  onChange={(e) => { pick(ev, e.target.value); stopLongClip(0); sfx(ev, { variant: e.target.value, force: true }); }}
                  className="eos-well h-9 max-w-[52%] rounded-md px-2 text-sm text-eos-bone"
                >
                  {list.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}{v.shinobi ? ' ·  shinobi' : ''}</option>
                  ))}
                </select>
              ) : (
                <span id={id} className="max-w-[52%] truncate text-sm text-eos-ash">{list[0].name}</span>
              )}
              <button
                type="button"
                onClick={() => { stopLongClip(0); sfx(ev, { force: true }); }}
                aria-label={`${t(`sound.ev.${ev}`)} ▶`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-eos-rise text-eos-bone hover:bg-eos-seam"
              >
                <Play size={14} className="fill-current" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

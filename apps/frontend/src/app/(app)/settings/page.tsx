'use client';

import { useState } from 'react';
import { http } from '@/lib/api';
import { useAppStore, ColorMode, Language, UserSettings } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Card, CardTitle } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { Segmented } from '@/components/ui/segmented';
import { ColorPicker } from '@/components/ui/color-picker';
import { BOARD_THEMES, PIECE_SETS, PIECE_SET_LABELS } from '@/lib/themes';
import { SOUND_PACK_KEYS, SoundPack, playSound } from '@/lib/sound';
import { pieceUrl } from '@/lib/pieces';

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const t = useT();
  const [saving, setSaving] = useState(false);

  async function patch(p: Partial<UserSettings>) {
    setSettings(p);
    setSaving(true);
    try {
      await http.patch('/users/me/settings', p);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('settings.title')}
        {saving && <span className="text-xs text-zinc-500 ml-2 font-normal">{t('settings.saving')}</span>}
      </h1>

      <Card className="space-y-3">
        <CardTitle>{t('settings.gameplay')}</CardTitle>

        <ToggleRow
          title={t('settings.focus')}
          hint={t('settings.focus_hint')}
          checked={settings.focusMode}
          onChange={(v) => patch({ focusMode: v })}
        />
        <ToggleRow
          title={t('settings.sound')}
          hint={t('settings.sound_hint')}
          checked={settings.soundEnabled}
          onChange={(v) => patch({ soundEnabled: v })}
        />

        <div className="pt-2">
          <div className="text-sm mb-2">{t('settings.sound_pack')}</div>
          <div className="grid grid-cols-3 gap-2">
            {SOUND_PACK_KEYS.map((pk) => (
              <button
                key={pk}
                onClick={() => { patch({ soundPack: pk as SoundPack }); playSound(pk, 'move'); }}
                className={`py-2 rounded-lg text-xs capitalize border transition-all ${
                  settings.soundPack === pk
                    ? 'bg-[var(--accent)] text-black border-transparent font-medium'
                    : 'border-[var(--border)] text-zinc-300 hover:bg-white/5'
                }`}
              >
                {pk}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <div className="text-sm">{t('settings.fixed_color')}</div>
          <div className="text-xs text-zinc-500 mb-2">{t('settings.fixed_color_hint')}</div>
          <Segmented
            value={settings.fixedColor}
            onChange={(v) => patch({ fixedColor: v as ColorMode })}
            options={[
              { value: 'auto',  label: t('settings.fixed_color.auto') },
              { value: 'white', label: t('settings.fixed_color.white') },
              { value: 'black', label: t('settings.fixed_color.black') },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>{t('settings.accent')}</CardTitle>
        <ColorPicker value={settings.accentColor} onChange={(c) => patch({ accentColor: c })} />
      </Card>

      <Card>
        <CardTitle>{t('settings.board_theme')}</CardTitle>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
          {Object.entries(BOARD_THEMES).map(([name, t]) => (
            <button
              key={name}
              onClick={() => patch({ boardTheme: name })}
              className={`p-1 rounded-xl border-2 transition-all ${
                settings.boardTheme === name ? 'border-[var(--accent)]' : 'border-transparent'
              }`}
            >
              <div className="grid grid-cols-4 grid-rows-4 overflow-hidden rounded-md aspect-square">
                {Array.from({ length: 16 }).map((_, i) => {
                  const row = Math.floor(i / 4);
                  const col = i % 4;
                  const light = (row + col) % 2 === 0;
                  return <div key={i} style={{ background: light ? t.light : t.dark }} />;
                })}
              </div>
              <div className="text-[10px] text-zinc-400 text-center mt-1 truncate">{t.label}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>{t('settings.piece_set')}</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
          {PIECE_SETS.map((set) => (
            <button
              key={set}
              onClick={() => patch({ pieceSet: set })}
              className={`rounded-xl p-2 border-2 transition-all ${
                settings.pieceSet === set ? 'border-[var(--accent)]' : 'border-transparent'
              } bg-white/5 hover:bg-white/10`}
            >
              <div className="flex items-center justify-center gap-0.5" style={{ background: '#ebecd0', borderRadius: 6, padding: 4 }}>
                <img src={pieceUrl(set, 'w', 'k')} alt="" className="h-10 w-10" />
                <img src={pieceUrl(set, 'b', 'q')} alt="" className="h-10 w-10" />
              </div>
              <div className="text-[10px] text-zinc-400 text-center mt-1 capitalize">{PIECE_SET_LABELS[set]}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>{t('settings.language')}</CardTitle>
        <Segmented
          value={settings.language}
          onChange={(v) => patch({ language: v as Language })}
          options={[
            { value: 'en', label: 'English' },
            { value: 'uk', label: 'Українська' },
          ]}
        />
      </Card>

      <Card>
        <CardTitle>{t('settings.install')}</CardTitle>
        <div className="text-sm">{t('settings.install_ready')}</div>
        <div className="text-xs text-zinc-500 mt-1">{t('settings.install_hint')}</div>
      </Card>
    </div>
  );
}

function ToggleRow({ title, hint, checked, onChange }: { title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div>
        <div className="text-sm">{title}</div>
        <div className="text-xs text-zinc-500">{hint}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} aria-label={title} />
    </div>
  );
}

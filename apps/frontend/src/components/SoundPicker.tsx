'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import {
  SOUND_THEMES,
  getSoundChoice,
  setSoundChoice,
  previewSound,
  type SoundSlot,
  type SoundKind,
} from '@/lib/sound';
import { cn } from '@/lib/utils';

type Props = {
  slot: SoundSlot;
  title: string;
};

/**
 * Variant picker for a single sound slot (correct or fail). Each tile
 * previews on tap AND becomes the persisted choice — no separate
 * "preview" / "apply" step because the tap itself is intentional.
 */
export function SoundPicker({ slot, title }: Props) {
  const [choice, setChoice] = useState(() => getSoundChoice(slot));
  const kind: SoundKind = slot;

  const pick = (id: string) => {
    setSoundChoice(slot, id);
    setChoice(id);
    previewSound(kind, id);
  };

  return (
    <div className="pt-2">
      <div className="text-sm mb-2">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        {SOUND_THEMES.map((th) => {
          const active = th.id === choice;
          return (
            <button
              key={th.id}
              type="button"
              onClick={() => pick(th.id)}
              className={cn(
                'relative h-10 rounded-lg text-xs border transition-colors flex items-center justify-center gap-1.5',
                active
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent font-medium'
                  : 'border-[var(--border)] text-zinc-300 hover:bg-white/5',
              )}
              aria-pressed={active}
            >
              {active && <Check size={12} />}
              {th.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import type { WoodpeckerDifficulty, WoodpeckerSet, WoodpeckerSize } from '@tac/core/api';
import { WOODPECKER_DEFAULT_DIFFICULTY, WOODPECKER_DEFAULT_SIZE, woodpeckerWindow } from '@tac/core/library';
import { levelFor } from '@tac/core/runner';
import { useState } from 'react';

import { readLastStyle } from '@/features/play/setupPrefs';
import { useAppStore } from '@/stores/appStore';
import { useT } from '@/ui/lang';
import { useCreateSet } from './api';

// The create form's state (phone sheet / empty state, desktop dialog):
// size, difficulty, and the style the Play setup has picked; the window
// shown is the one the server draws from (woodpeckerWindow in core).

export function useCreateForm(replace: string | null, onCreated: (set: WoodpeckerSet) => void) {
  const t = useT();
  const [style] = useState(readLastStyle);
  const level = levelFor(useAppStore((s) => s.progressions[style]));
  const [size, setSize] = useState<WoodpeckerSize>(WOODPECKER_DEFAULT_SIZE);
  const [difficulty, setDifficulty] = useState<WoodpeckerDifficulty>(WOODPECKER_DEFAULT_DIFFICULTY);
  const create = useCreateSet();
  const windowOf = (d: WoodpeckerDifficulty) => woodpeckerWindow(level, d);
  const submit = () => {
    if (create.isPending) return;
    create.mutate({ body: { size, difficulty, style }, replace }, { onSuccess: onCreated });
  };
  return {
    t,
    style,
    styleName: t(`style.${style}.name`),
    level,
    size,
    setSize,
    difficulty,
    setDifficulty,
    windowOf,
    windowText: (d: WoodpeckerDifficulty) => {
      const w = windowOf(d);
      return t('woodpecker.window', { min: w.min, max: w.max });
    },
    submit,
    busy: create.isPending,
    failed: create.isError,
  };
}

export type CreateForm = ReturnType<typeof useCreateForm>;

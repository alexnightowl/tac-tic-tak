import type { WoodpeckerSet } from '@tac/core/api';
import { levelFor } from '@tac/core/runner';
import { useState } from 'react';

import { readLastStyle } from '@/features/play/setupPrefs';
import { useAppStore } from '@/stores/appStore';
import { useT } from '@/ui/lang';
import { useStartSet } from './api';

// Starting the method (phone empty state, desktop page, New set): no
// choices (D41). The style is the one the Play setup last used; its level
// places the pool.

export function useStartMethod(replace: string | null, onStarted?: (set: WoodpeckerSet) => void) {
  const t = useT();
  const [style] = useState(readLastStyle);
  const level = levelFor(useAppStore((s) => s.progressions[style]));
  const start = useStartSet();
  return {
    style,
    level,
    levelLine: t('woodpecker.from_level', { style: t(`style.${style}.name`), level }),
    start: () => {
      if (!start.isPending) start.mutate({ style, replace }, { onSuccess: onStarted });
    },
    busy: start.isPending,
    failed: start.isError,
  };
}

export type StartMethod = ReturnType<typeof useStartMethod>;

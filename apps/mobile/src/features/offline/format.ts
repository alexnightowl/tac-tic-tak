import { interpolate, type Language } from '@tac/core/i18n';
import { PACK_DEFAULT_COUNT, topThemes, type StoredPack } from '@tac/core/offline';
import { tacticalThemes } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { eos, tone } from '@tac/core/tokens';

import type { TFn, TnFn } from '@/ui/lang';
import type { PackKey } from './store';

/** Pack swatch colours (OfflinePacks: level ember, weak copper, mate moss); not saved = iron. */
export const PACK_SWATCH: Record<PackKey, string> = {
  level: eos.ember,
  weak: tone.copper,
  mate: tone.moss,
  endgame: tone.sand,
  hard: tone.rose,
  review: tone.gold,
};
export const SWATCH_EMPTY = tone.iron;

/** `tn` with `{n}` (and extra vars) filled in. */
export function plural(tn: TnFn, key: string, n: number, vars: Record<string, string | number> = {}): string {
  return interpolate(tn(key, n), { n, ...vars });
}

/** "12 KB" under a megabyte (packs are small), else "1.4 MB". */
export function formatSize(bytes: number, t: TFn): string {
  if (bytes < 1024 * 1024) return t('offline.size_kb', { n: Math.max(1, Math.round(bytes / 1024)) });
  return t('offline.size_mb', { n: (bytes / (1024 * 1024)).toFixed(1) });
}

export const packTitle = (key: PackKey, t: TFn) => t(`offline.pack.${key}`);
export const packShort = (key: PackKey, t: TFn) => t(`offline.short.${key}`);

/**
 * The row's second line, as the design writes it:
 * level "50 puzzles · 11 KB · auto", weak "Forks, pins, back rank · 30 · 7 KB",
 * mate "Mate in 1–3 · 40 · 9 KB", others "40 puzzles · 9 KB".
 */
export function packMeta(
  key: PackKey,
  pack: StoredPack | null,
  left: number,
  bytes: number,
  { t, tn, lang }: { t: TFn; tn: TnFn; lang: Language },
): string {
  const count = pack ? left : key === 'review' ? 0 : PACK_DEFAULT_COUNT[key];
  const size = pack ? formatSize(bytes, t) : null;
  if (key === 'weak' || key === 'mate') {
    let desc = t(`offline.desc.${key}`);
    if (key === 'weak' && pack) {
      const themes = tacticalThemes(topThemes(pack.puzzles, 12)).slice(0, 3);
      if (themes.length > 0) desc = themes.map((s) => themeLabel(s, lang)).join(', ');
    }
    return [desc, String(count), size].filter(Boolean).join(' · ');
  }
  if (key === 'review') {
    if (!pack || count === 0) return [t('offline.desc.review'), t('offline.auto')].join(' · ');
    return [plural(tn, 'offline.n_puzzles', count), size, t('offline.auto')].filter(Boolean).join(' · ');
  }
  const parts = [plural(tn, 'offline.n_puzzles', count), size];
  if (key === 'level') parts.push(t('offline.auto'));
  return parts.filter(Boolean).join(' · ');
}

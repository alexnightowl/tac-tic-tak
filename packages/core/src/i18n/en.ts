// The en app dictionary: every area of ./areas merged. The web keys were
// moved verbatim from apps/frontend/src/lib/i18n.ts (en dict) into the
// areas; add new keys to the owning area file, never here.
import { mergeAreas } from './areas';
import type { Dict } from './types';

export const en: Dict = mergeAreas('en');

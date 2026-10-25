// The uk app dictionary: every area of ./areas merged. The web keys were
// moved verbatim from apps/frontend/src/lib/i18n.ts (uk dict) into the
// areas; add new keys to the owning area file, never here.
import { mergeAreas } from './areas';
import type { Dict } from './types';

export const uk: Dict = mergeAreas('uk');

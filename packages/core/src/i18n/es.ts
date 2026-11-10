// The es app dictionary: every area of ./areas merged. Add new keys to the
// owning area file (<area>.es.ts), never here.
import { mergeAreas } from './areas';
import type { Dict } from './types';

export const es: Dict = mergeAreas('es');

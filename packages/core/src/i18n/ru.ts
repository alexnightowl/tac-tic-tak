// The ru app dictionary: every area of ./areas merged. Add new keys to the
// owning area file (<area>.ru.ts), never here.
import { mergeAreas } from './areas';
import type { Dict } from './types';

export const ru: Dict = mergeAreas('ru');

import { BAND_ICON_KEY, bandFor, type BandIconKey } from '@tac/core/rules';

/** The rank eyes, one per difficulty band. */
export const BAND_ICONS: Record<BandIconKey, number> = {
  'tomoe-1': require('../../../../assets/icons/tomoe-1.webp'),
  'tomoe-2': require('../../../../assets/icons/tomoe-2.webp'),
  'tomoe-3': require('../../../../assets/icons/tomoe-3.webp'),
  'rank-4': require('../../../../assets/icons/rank-4.webp'),
  'rank-5': require('../../../../assets/icons/rank-5.webp'),
};

/** The eye of the band a rating falls in. */
export function bandIcon(rating: number): number {
  return BAND_ICONS[BAND_ICON_KEY[bandFor(rating).key]];
}

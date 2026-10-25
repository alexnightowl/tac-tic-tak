// Static requires (Metro needs literals); each resolves its @2x/@3x pair.
// Generated from assets/plates/plates.json — sizes live in @tac/core/tokens layout.
export type PlateVariant = 'ember' | 'slate';
export type PlateSize = 'sm' | 'md' | 'lg';
/** Metro asset ids (a static require of an image is a number). */
type Slices = { left: number; mid: number; right: number };

export const PLATE_IMAGES: Record<PlateVariant, Record<PlateSize, Slices>> = {
  ember: {
    sm: { left: require('../../assets/plates/ember-sm-left.webp'), mid: require('../../assets/plates/ember-sm-mid.webp'), right: require('../../assets/plates/ember-sm-right.webp') },
    md: { left: require('../../assets/plates/ember-md-left.webp'), mid: require('../../assets/plates/ember-md-mid.webp'), right: require('../../assets/plates/ember-md-right.webp') },
    lg: { left: require('../../assets/plates/ember-lg-left.webp'), mid: require('../../assets/plates/ember-lg-mid.webp'), right: require('../../assets/plates/ember-lg-right.webp') },
  },
  slate: {
    sm: { left: require('../../assets/plates/slate-sm-left.webp'), mid: require('../../assets/plates/slate-sm-mid.webp'), right: require('../../assets/plates/slate-sm-right.webp') },
    md: { left: require('../../assets/plates/slate-md-left.webp'), mid: require('../../assets/plates/slate-md-mid.webp'), right: require('../../assets/plates/slate-md-right.webp') },
    lg: { left: require('../../assets/plates/slate-lg-left.webp'), mid: require('../../assets/plates/slate-lg-mid.webp'), right: require('../../assets/plates/slate-lg-right.webp') },
  },
};

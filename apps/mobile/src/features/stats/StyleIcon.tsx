import type { TrainingStyle } from '@tac/core/rules';
import { eos } from '@tac/core/tokens';
import { Image } from 'expo-image';

// Web StyleIcon: single-colour time-control masks (rapid hourglass, blitz
// lightning, bullet kunai) tinted with the surrounding text colour.
const SRC: Record<TrainingStyle, number> = {
  bullet: require('../../../assets/icons/mode-bullet.webp'),
  blitz: require('../../../assets/icons/mode-blitz.webp'),
  rapid: require('../../../assets/icons/mode-rapid.webp'),
};

/** Web STYLE_ORDER: every picker and list runs slowest → fastest. */
export const STYLE_ORDER: TrainingStyle[] = ['rapid', 'blitz', 'bullet'];

export function StyleIcon({ style, size = 14, color = eos.bone }: { style: TrainingStyle; size?: number; color?: string }) {
  return (
    <Image
      source={SRC[style]}
      style={{ width: size, height: size }}
      tintColor={color}
      contentFit="contain"
      transition={null}
      accessible={false}
    />
  );
}

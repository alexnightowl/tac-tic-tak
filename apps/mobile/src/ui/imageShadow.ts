import { black } from '@tac/core/tokens';
import { Platform, type ViewStyle } from 'react-native';

/**
 * The design's `drop-shadow(0 <y>px <blur>px black/<opacity>)` under a
 * transparent image (logo, rank eye, a piece). iOS shadows follow the
 * image's alpha; on the web a shadow is a box-shadow (a square around the
 * art), so the browser gets the CSS drop-shadow itself.
 */
export function imageShadow(y: number, blur: number, opacity: number): ViewStyle {
  const a = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return Platform.select<ViewStyle>({
    web: { filter: `drop-shadow(0px ${y}px ${blur}px ${black}${a})` },
    default: { shadowColor: black, shadowOffset: { width: 0, height: y }, shadowOpacity: opacity, shadowRadius: blur / 2 },
  });
}

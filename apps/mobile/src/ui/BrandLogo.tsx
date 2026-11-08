import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { imageShadow } from '@/ui/imageShadow';
import { LogoGlowDisc } from '@/ui/LogoGlowDisc';

const LOGO = require('../../assets/icons/knight-logo.webp');

/** Glow disc diameter and blur in pt (the canvas draws it per screen). */
export type LogoGlow = { box: number; blur: number };

/** Tab header (MobRivals / MobStats): 120 pt disc around the 32 pt logo, blur 5. */
export const HEADER_LOGO_GLOW: LogoGlow = { box: 120, blur: 5 };

type Props = {
  size: number;
  /**
   * Soft ember glow behind the knight. `true` = the Login proportions
   * (360 / 128 of the logo, blur 14 / 128); an object sets the disc size
   * and blur directly (always centred on the logo, gradient at 50% 46%).
   */
  glow?: boolean | LogoGlow;
};

/**
 * Brand mark, exactly as the design canvas draws it (Login.dc.html, 128 px
 * logo): a 360 px circle offset −116 px, `radial-gradient(circle at 50% 46%)`
 * to the farthest corner, `blur(14px)`, all scaled with `size`; and
 * `drop-shadow(0 8px 14px rgba(17,15,17,.55))` on the knight (iOS shadows
 * follow the image's alpha).
 */
export function BrandLogo({ size, glow = true }: Props) {
  const k = size / 128;
  const spec = typeof glow === 'object' ? glow : null;
  const box = spec ? spec.box : 360 * k;
  // CSS blur(r) is a Gaussian with σ = r.
  const sigma = spec ? spec.blur : 14 * k;
  const offset = (size - box) / 2;
  return (
    <View style={{ width: size, height: size }} accessibilityIgnoresInvertColors>
      {glow && <LogoGlowDisc box={box} blur={sigma} offset={offset} />}
      <View style={size >= 64 ? styles.shadow : undefined}>
        <Image source={LOGO} style={{ width: size, height: size }} contentFit="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: imageShadow(8, 14, 0.55),
});

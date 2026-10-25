import { black, logoGlow } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const LOGO = require('../../assets/icons/knight-logo.webp');

// react-native-svg ignores the alpha inside an rgba() stopColor: split each
// token stop into rgb + stopOpacity.
const GLOW_STOPS = logoGlow.map(([offset, rgba]) => {
  const [r, g, b, a] = rgba.match(/[\d.]+/g)!.map(Number);
  return { offset, color: `rgb(${r},${g},${b})`, opacity: a };
});

type Props = {
  size: number;
  /** Soft ember glow behind the knight (web Logo `glow`). */
  glow?: boolean;
};

/**
 * Brand mark: the cut-out sharingan knight (web components/brand/Logo.tsx,
 * dark tone). The glow is the web's radial gradient — 2.8× the mark,
 * centred at 50% / 46% — drawn in svg; the stops already fade to nothing,
 * which stands in for the web's extra CSS blur. Marks of 64 px and up get
 * the web's drop shadow (iOS shadows follow the image's alpha).
 */
export function BrandLogo({ size, glow = true }: Props) {
  const glowSize = size * 2.8;
  return (
    <View style={{ width: size, height: size }} accessibilityIgnoresInvertColors>
      {glow && (
        <Svg
          pointerEvents="none"
          width={glowSize}
          height={glowSize}
          style={[styles.glow, { left: -size * 0.9, top: -size * 0.9 }]}
        >
          <Defs>
            <RadialGradient id="logoGlow" cx="50%" cy="46%" r="50%">
              {GLOW_STOPS.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
              ))}
            </RadialGradient>
          </Defs>
          <Rect width={glowSize} height={glowSize} fill="url(#logoGlow)" />
        </Svg>
      )}
      <View style={size >= 64 ? styles.shadow : undefined}>
        <Image source={LOGO} style={{ width: size, height: size }} contentFit="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
  // web: drop-shadow(0 8px 14px rgba(17,15,17,0.55))
  shadow: {
    shadowColor: black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 7,
  },
});

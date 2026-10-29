import { black, logoGlow } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, RadialGradient, Stop } from 'react-native-svg';

const LOGO = require('../../assets/icons/knight-logo.webp');

// react-native-svg ignores the alpha inside an rgba() stopColor: split each
// token stop into rgb + stopOpacity.
const GLOW_STOPS = logoGlow.map(([offset, rgba]) => {
  const [r, g, b, a] = rgba.match(/[\d.]+/g)!.map(Number);
  return { offset, color: `rgb(${r},${g},${b})`, opacity: a };
});

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
 * follow the image's alpha). The svg canvas is padded by 3σ so the blur is
 * never cut at its edge.
 */
export function BrandLogo({ size, glow = true }: Props) {
  const id = useId().replace(/:/g, '');
  const k = size / 128;
  const spec = typeof glow === 'object' ? glow : null;
  const box = spec ? spec.box : 360 * k;
  // CSS blur(r) is a Gaussian with σ = r.
  const sigma = spec ? spec.blur : 14 * k;
  const pad = Math.ceil(sigma * 3);
  const c = pad + box / 2;
  const offset = (size - box) / 2;
  return (
    <View style={{ width: size, height: size }} accessibilityIgnoresInvertColors>
      {glow && (
        <Svg
          pointerEvents="none"
          width={box + pad * 2}
          height={box + pad * 2}
          style={[styles.glow, { left: offset - pad, top: offset - pad }]}
        >
          <Defs>
            <RadialGradient
              id={`g${id}`}
              gradientUnits="userSpaceOnUse"
              cx={c}
              cy={pad + box * 0.46}
              r={Math.hypot(box / 2, box * 0.54)}
            >
              {GLOW_STOPS.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
              ))}
            </RadialGradient>
            <Filter id={`b${id}`} x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
              <FeGaussianBlur stdDeviation={sigma} />
            </Filter>
          </Defs>
          <Circle cx={c} cy={c} r={box / 2} fill={`url(#g${id})`} filter={`url(#b${id})`} />
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
  shadow: {
    shadowColor: black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 7,
  },
});

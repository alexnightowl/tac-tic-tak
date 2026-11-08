import { logoGlow } from '@tac/core/tokens';
import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, RadialGradient, Stop } from 'react-native-svg';

// react-native-svg ignores the alpha inside an rgba() stopColor: split each
// token stop into rgb + stopOpacity.
const GLOW_STOPS = logoGlow.map(([offset, rgba]) => {
  const [r, g, b, a] = rgba.match(/[\d.]+/g)!.map(Number);
  return { offset, color: `rgb(${r},${g},${b})`, opacity: a };
});

type Props = { box: number; blur: number; offset: number };

/**
 * BrandLogo's ember glow: a `box` disc, gradient at 50% 46% to the farthest
 * corner, Gaussian blur σ = `blur`, its top-left at `offset` from the logo's.
 * The svg canvas is padded by 3σ so the blur is never cut at its edge.
 */
export function LogoGlowDisc({ box, blur, offset }: Props) {
  const id = useId().replace(/:/g, '');
  const pad = Math.ceil(blur * 3);
  const c = pad + box / 2;
  return (
    <Svg
      pointerEvents="none"
      width={box + pad * 2}
      height={box + pad * 2}
      style={[styles.glow, { left: offset - pad, top: offset - pad }]}
    >
      <Defs>
        <RadialGradient id={`g${id}`} gradientUnits="userSpaceOnUse" cx={c} cy={pad + box * 0.46} r={Math.hypot(box / 2, box * 0.54)}>
          {GLOW_STOPS.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
          ))}
        </RadialGradient>
        <Filter id={`b${id}`} x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
          <FeGaussianBlur stdDeviation={blur} />
        </Filter>
      </Defs>
      <Circle cx={c} cy={c} r={box / 2} fill={`url(#g${id})`} filter={`url(#b${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({ glow: { position: 'absolute' } });

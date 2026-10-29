import { alpha, black, eos, radii, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { WELCOME, ease, kf, useTrack } from './motion';
import { RadialDisc } from './parts';

const LOGO = require('../../../assets/icons/knight-logo.webp');

const BOX = 280;
const LOGO_SIZE = 150;

const GLOW_STOPS = [
  [0, alpha(tone.emberGlow, 0.45)],
  [0.42, alpha(eos.ember, 0.16)],
  [0.7, alpha(eos.ink, 0)],
] as const;

/**
 * MobOnboarding1 hero: the breathing ember disc, three ripples 1.2 s apart,
 * the knight floating after `logoIn` (opacity/scale/rise; the CSS blur(6px)
 * on the way in is not reproduced — RN can't animate an image blur on the
 * UI thread).
 */
export function WelcomeArt() {
  const breathe = useTrack(WELCOME.breathe, 0.5);
  const logoIn = useTrack(WELCOME.logoIn);
  const float = useTrack(WELCOME.float, 0);

  const disc = useAnimatedStyle(() => {
    const p = breathe.get();
    return {
      opacity: kf(p, [[0, 0.75], [0.5, 1], [1, 0.75]], ease.inOut),
      transform: [{ scale: kf(p, [[0, 0.92], [0.5, 1.06], [1, 0.92]], ease.inOut) }],
    };
  });
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: kf(float.get(), [[0, 0], [0.5, -6], [1, 0]], ease.inOut) }],
  }));
  const inStyle = useAnimatedStyle(() => {
    const e = ease.outSoft(logoIn.get());
    return { opacity: e, transform: [{ translateY: 10 * (1 - e) }, { scale: 0.82 + 0.18 * e }] };
  });

  return (
    <View style={styles.box}>
      <Animated.View style={[styles.fill, disc]}>
        <RadialDisc size={BOX} stops={GLOW_STOPS} />
      </Animated.View>
      {WELCOME.ripple.delays.map((delay, i) => (
        <Ripple key={delay} delay={delay} still={i === 0 ? 0.5 : 1} />
      ))}
      <Animated.View style={floatStyle}>
        <Animated.View style={[styles.logoShadow, inStyle]}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" accessibilityIgnoresInvertColors />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** `.ring`: 1.5 pt rose/45 inner ring, scale .55 → 1.25 while fading out. */
function Ripple({ delay, still }: { delay: number; still: number }) {
  const p = useTrack({ duration: WELCOME.ripple.duration, delay, loop: true }, still);
  const style = useAnimatedStyle(() => {
    const t = p.get();
    return {
      opacity: kf(t, [[0, 0.55], [1, 0]], ease.ripple),
      transform: [{ scale: kf(t, [[0, 0.55], [1, 1.25]], ease.ripple) }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.fill, styles.ring, style]} />;
}

const styles = StyleSheet.create({
  box: { width: BOX, height: BOX, alignItems: 'center', justifyContent: 'center' },
  fill: { ...StyleSheet.absoluteFill },
  ring: { borderRadius: radii.full, borderWidth: 1.5, borderColor: alpha(tone.rose, 0.45) },
  // drop-shadow(0 12px 22px rgba(17,15,17,.6)); iOS follows the image alpha.
  logoShadow: { shadowColor: black, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.6, shadowRadius: 11 },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
});

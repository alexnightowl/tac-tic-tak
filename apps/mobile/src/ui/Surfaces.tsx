import { eos, layout, radii, shadows, surface } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

const SLATE = require('../../assets/textures/slate.webp');

type SurfaceProps = ViewProps & { children?: ReactNode; style?: StyleProp<ViewStyle> };

/** `.glass` card: flat slate, 1 px seam, inset top highlight + soft drop. */
export function Card({ style, children, ...rest }: SurfaceProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

/**
 * `.tx-slate` hero card: the seamless slate texture tiled (RN Image
 * `resizeMode="repeat"` — expo-image does not tile) under a vertical veil.
 * The drop shadow sits on an unclipped outer view; the 1 px inset ring is
 * an overlay border because the texture would paint over an inset shadow.
 */
export function HeroCard({ style, children, ...rest }: SurfaceProps) {
  return (
    <View style={[styles.heroOuter, style]} {...rest}>
      <View style={styles.heroClip} pointerEvents="none">
        <Image source={SLATE} resizeMode="repeat" style={styles.fill} />
        <LinearGradient colors={[surface.heroVeilTop, surface.heroVeilBottom]} style={styles.fill} />
        <View style={styles.heroRing} />
      </View>
      {children}
    </View>
  );
}

/** `.eos-well`: carved inset (New-Architecture inset boxShadow). */
export function Well({ style, children, ...rest }: SurfaceProps) {
  return (
    <View style={[styles.well, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  card: {
    backgroundColor: surface.card,
    borderRadius: radii.cardComponent,
    borderWidth: 1,
    borderColor: surface.cardBorder,
    padding: layout.cardPadding,
    boxShadow: [...shadows.card],
  },
  heroOuter: {
    borderRadius: radii.cardComponent,
    padding: layout.heroCardPadding,
    backgroundColor: eos.slate,
    boxShadow: [shadows.heroCard[1]],
  },
  heroClip: { ...StyleSheet.absoluteFill, borderRadius: radii.cardComponent, overflow: 'hidden' },
  heroRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.cardComponent,
    borderWidth: shadows.heroCard[0].spreadDistance,
    borderColor: shadows.heroCard[0].color,
  },
  well: {
    backgroundColor: eos.well,
    borderRadius: radii.control,
    boxShadow: [...shadows.well],
  },
});

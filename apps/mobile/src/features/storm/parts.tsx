import { alpha, eos, radii, space, tone } from '@tac/core/tokens';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { AppText, Card, HeroCard } from '@/ui';

/** The Storm bolt (canvas path), stroked in the given colour. */
export function Bolt({ size = 18, color, strokeWidth = 1.8, fill = 'none' }: { size?: number; color: string; strokeWidth?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </Svg>
  );
}

const HEART = 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z';

/** One life: filled ember while left, an iron outline once lost. */
export function Heart({ on, size = 18 }: { on: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={on ? eos.ember : 'none'} stroke={on ? eos.ember : tone.iron} strokeWidth={1.8} strokeLinejoin="round">
      <Path d={HEART} />
    </Svg>
  );
}

/** StormStart's 56 pt ember tile: radial ember glow on the warm ground, the bolt in blush. */
export function StormEmblem({ size = 56 }: { size?: number }) {
  return (
    <View style={[styles.emblem, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="storm-emblem" cx="50%" cy="40%" r="70%">
            <Stop offset="0" stopColor={tone.emberGlow} stopOpacity={0.45} />
            <Stop offset="1" stopColor={eos.embers} stopOpacity={0.4} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#storm-emblem)" />
      </Svg>
      <Bolt size={Math.round(size / 2)} color={tone.blush} />
    </View>
  );
}

/** A small caps label over a big Cinzel number and a faint line (Start's Your best / Today). */
export function NumberTile({
  label,
  value,
  sub,
  hero = false,
  testID,
  style,
}: {
  label: string;
  value: string;
  sub: string;
  hero?: boolean;
  testID: string;
  style?: StyleProp<ViewStyle>;
}) {
  const body = (
    <>
      <AppText variant="label" color={eos.ash}>
        {label}
      </AppText>
      <AppText variant="sectionTitle" style={styles.tileValue} testID={`${testID}-value`}>
        {value}
      </AppText>
      <AppText variant="caption" color={eos.dust} numberOfLines={1}>
        {sub}
      </AppText>
    </>
  );
  return hero ? (
    <HeroCard style={[styles.tile, style]} testID={testID} accessible accessibilityLabel={`${label}, ${value}, ${sub}`}>
      {body}
    </HeroCard>
  ) : (
    <Card padding={space[3.5]} radius={radii.card} style={[styles.tile, style]} testID={testID} accessible accessibilityLabel={`${label}, ${value}, ${sub}`}>
      {body}
    </Card>
  );
}

/** Stat tile on the result (Solved / Accuracy / …). */
export function StatTile({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <Card padding={space[3]} radius={radii.card} style={styles.stat} testID={testID} accessible accessibilityLabel={`${label}, ${value}`}>
      <AppText variant="label" color={eos.ash} numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="value" style={styles.statValue}>
        {value}
      </AppText>
    </Card>
  );
}

/** A chip pill in ember tint (combo, new best). */
export function EmberChip({ children, testID, style }: { children: ReactNode; testID?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.chip, style]} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  emblem: {
    borderRadius: radii.featureTile,
    overflow: 'hidden',
    backgroundColor: tone.warmGlow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(eos.ember, 0.5),
  },
  tile: { flex: 1, padding: space[3.5], borderRadius: radii.card },
  tileValue: { marginTop: space[1], fontVariant: ['tabular-nums'] },
  stat: { flexBasis: '47%', flexGrow: 1 },
  statValue: { marginTop: space[0.5], fontSize: 22, lineHeight: 28 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    height: 24,
    paddingHorizontal: 9,
    borderRadius: radii.full,
    backgroundColor: alpha(eos.ember, 0.2),
  },
});

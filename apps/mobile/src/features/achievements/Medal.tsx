import { alpha, black, eos, tone, type Shadow } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { FlameGlyph } from '@/features/social/glyphs';
import { fontFamily } from '@/ui/fonts';
import { medalArt, TIER_RING, type Tier } from './art';

// The design v2 achievement medal (MobAchievements, MobAchievementSheet):
// a disc in a box 12 pt wider (64 in 76 on the grid, 84 in 96 on the hero,
// 120 in 132 on the sheet). Unlocked = ember radial disc, a 2 pt tier ring
// over a 4 pt ink ring, parchment glyph; locked = stone disc, 1 pt ring,
// pewter glyph (eyes greyed), and a lock badge when no progress is known.
// Every inner size scales with the disc (the canvas grid is the 64 base).

const EYES = {
  1: require('../../../assets/achievements/eye-1.webp'),
  3: require('../../../assets/achievements/eye-3.webp'),
  4: require('../../../assets/achievements/eye-4.webp'),
  5: require('../../../assets/achievements/eye-5.webp'),
} as const;
const EYES_LOCKED = {
  1: require('../../../assets/achievements/eye-1-locked.webp'),
  3: require('../../../assets/achievements/eye-3-locked.webp'),
  4: require('../../../assets/achievements/eye-4-locked.webp'),
  5: require('../../../assets/achievements/eye-5-locked.webp'),
} as const;

const sh = (offsetY: number, blurRadius: number, spreadDistance: number, color: string, inset = false): Shadow =>
  inset
    ? { offsetX: 0, offsetY, blurRadius, spreadDistance, color, inset: true }
    : { offsetX: 0, offsetY, blurRadius, spreadDistance, color };

/** `radial-gradient(circle at 34% 28%, hi 0%, mid 48|55%, lo 100%)`. */
const radial = (c: readonly [string, string, string], mid: number) =>
  `radial-gradient(circle at 34% 28%, ${c[0]} 0%, ${c[1]} ${mid}%, ${c[2]} 100%)`;
const EMBER_DISC = radial(tone.medalEmber, 48);
const STONE_DISC = radial(tone.medalStone, 55);
/** Fresh-unlock halo behind the box (inset −14). The canvas fades to
 *  transparent ink; RN interpolates unpremultiplied, so fade to transparent
 *  gold instead (what the browser actually paints). */
const GLOW = `radial-gradient(circle at 50% 50%, ${alpha(tone.gold, 0.38)}, ${alpha(tone.gold, 0)} 68%)`;

const unlockedShadow = (tier: Tier): Shadow[] => [
  sh(0, 0, 2, TIER_RING[tier]),
  sh(0, 0, 4, alpha(black, 0.7)),
  sh(2, 1, 0, alpha(tone.parchment, 0.22), true),
  sh(-4, 8, 0, alpha(black, 0.55), true),
  sh(8, 18, 0, alpha(black, 0.55)),
];
const LOCKED_SHADOW: Shadow[] = [
  sh(0, 0, 1, tone.medalStoneRing),
  sh(2, 1, 0, alpha(eos.bone, 0.06), true),
  sh(-4, 8, 0, alpha(black, 0.5), true),
];

export function Medal({
  slug,
  unlocked,
  disc = 64,
  glow = false,
  lockBadge = false,
}: {
  slug: string;
  unlocked: boolean;
  /** Disc diameter; the box is disc + 12. */
  disc?: number;
  /** Gold halo (fresh unlock, the hero's latest). */
  glow?: boolean;
  /** The small lock on a locked medal with no progress to show. */
  lockBadge?: boolean;
}) {
  const { art, tier } = medalArt(slug);
  const k = disc / 64;
  const box = disc + 12;
  const ink = unlocked ? tone.parchment : tone.pewter;
  let glyph;
  if (art.kind === 'eye') {
    const s = Math.round(disc * 0.78);
    glyph = (
      <Image
        source={unlocked ? EYES[art.eye] : EYES_LOCKED[art.eye]}
        style={{ width: s, height: s }}
        contentFit="contain"
        transition={null}
        accessible={false}
      />
    );
  } else if (art.kind === 'flame') {
    glyph = (
      <>
        <FlameGlyph size={36 * k} color={ink} />
        <Text
          allowFontScaling={false}
          style={[
            styles.count,
            {
              bottom: 4 * k,
              fontSize: 13 * k,
              lineHeight: 16 * k,
              color: unlocked ? tone.parchment : tone.stone,
              fontFamily: fontFamily('en', 'display', 700),
            },
          ]}
        >
          {String(art.count)}
        </Text>
      </>
    );
  } else {
    glyph = (
      <Svg width={32 * k} height={32 * k} viewBox="0 0 24 24" accessible={false}>
        <Path d={art.d} fill="none" stroke={ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {glow ? <View pointerEvents="none" style={[styles.glow, { borderRadius: box }]} /> : null}
      <View
        style={[
          styles.disc,
          {
            width: disc,
            height: disc,
            borderRadius: disc / 2,
            backgroundImage: unlocked ? EMBER_DISC : STONE_DISC,
            boxShadow: unlocked ? unlockedShadow(tier) : LOCKED_SHADOW,
          },
        ]}
      >
        {glyph}
        {!unlocked && lockBadge ? <LockBadge size={18 * k} inset={2 * k} /> : null}
      </View>
    </View>
  );
}

/** 18 pt ink disc, 1 pt stone ring, a 10 pt dust padlock (stroke 2.6). */
function LockBadge({ size, inset }: { size: number; inset: number }) {
  const g = (size * 10) / 18;
  return (
    <View
      style={[
        styles.lock,
        { width: size, height: size, borderRadius: size / 2, right: inset, bottom: inset, boxShadow: [sh(0, 0, 1, tone.medalStoneRing)] },
      ]}
    >
      <Svg width={g} height={g} viewBox="0 0 24 24" fill="none" stroke={eos.dust} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={4.5} y={11} width={15} height={10} rx={2} />
        <Path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: -14, left: -14, right: -14, bottom: -14, backgroundImage: GLOW },
  disc: { alignItems: 'center', justifyContent: 'center' },
  count: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    textShadowColor: alpha(black, 0.8),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  lock: { position: 'absolute', backgroundColor: eos.ink, alignItems: 'center', justifyContent: 'center' },
});

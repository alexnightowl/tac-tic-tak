import { control, layout, radii, shadows, space, tone } from '@tac/core/tokens';
import { Image, type ImageSource } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { feel } from '@/feel';
import { AppText, textStyle } from './AppText';
import { useLang } from './lang';
import { segmentedSpring } from './motion';
import { Well } from './Surfaces';
import { Tap } from './Tap';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** 16 pt mask icon before the label (play-setup styles), tinted with the label. */
  icon?: ImageSource | number;
  /** Small pill after the label (`?2/5` calibration). */
  badge?: string;
  /** a11y label override (defaults to label + badge). */
  accessibilityLabel?: string;
};

/**
 * - `md`: 38 pt segments, 14 pt labels (Stats/Achievements, Rivals style);
 * - `sm`: 32 pt segments, 12 pt labels (theme order, leaderboard scope, settings board rows);
 * - `tight`: the play-setup / theme-picker track — 38 pt outside, 30 pt segments, 14 pt labels.
 */
export type SegmentedSize = 'sm' | 'md' | 'tight';

/**
 * - `carved` (default): page-level `.well` track (`inset 0 2px 4px`), active
 *   segment with a top highlight and a 2 pt inner bottom shade;
 * - `soft`: the track inside a grouped list (settings language / board):
 *   `inset 0 2px 3px` + a bone/3 % ring, active segment with a small drop.
 */
export type SegmentedTone = 'carved' | 'soft';

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: SegmentedSize;
  tone?: SegmentedTone;
  /** Each tab gets `${testID}-${value}`. */
  testID: string;
  accessibilityLabel: string;
  /** Width etc. (stretches by default; Rivals' scope switch is 220 wide). */
  style?: StyleProp<ViewStyle>;
};

const PAD = layout.segmentedTrackPadding;

/**
 * Carved track with one ember plate that slides between segments (the
 * design swaps instantly; a moving plate can't show two half-lit tabs
 * either). The plate position and label colours run on SharedValues; only
 * `value` changes re-render, once per selection.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  tone: trackTone = 'carved',
  testID,
  accessibilityLabel,
  style,
}: SegmentedProps<T>) {
  const { lang } = useLang();
  const reduced = useReducedMotion();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const pos = useSharedValue(index);
  const target = useSharedValue(index);
  const innerW = useSharedValue(0);
  const n = options.length;

  const go = (i: number) => {
    if (target.get() === i) return;
    target.set(i);
    pos.set(reduced ? i : withSpring(i, segmentedSpring));
  };

  // Follow external changes (parent resets, restored settings).
  useEffect(() => {
    go(index);
  });

  const plate = useAnimatedStyle(() => {
    const w = innerW.get() / n;
    return { width: w, opacity: w > 0 ? 1 : 0, transform: [{ translateX: pos.get() * w }] };
  });

  const h = layout.segmentedHeight[size];
  const labelStyle = textStyle(size === 'sm' ? 'segmentedSm' : 'segmented', lang);
  const soft = trackTone === 'soft';

  return (
    <Well
      tone={soft ? 'soft' : 'carved'}
      style={[styles.track, style]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => {
        innerW.set(e.nativeEvent.layout.width - PAD * 2);
      }}
    >
      <Animated.View pointerEvents="none" style={[styles.plate, soft && styles.plateSoft, { height: h }, plate]} />
      {options.map((o, i) => (
        <Tap
          key={o.value}
          testID={`${testID}-${o.value}`}
          accessibilityRole="tab"
          accessibilityLabel={o.accessibilityLabel ?? (o.badge ? `${o.label}, ${o.badge}` : o.label)}
          accessibilityState={{ selected: i === index }}
          hitSlop={{ top: Math.max(0, (44 - h) / 2), bottom: Math.max(0, (44 - h) / 2) }}
          style={[styles.tab, { height: h }]}
          onPress={() => {
            if (o.value === value) return;
            go(i);
            feel.emit('segmented');
            onChange(o.value);
          }}
        >
          {o.icon != null ? <SegIcon pos={pos} i={i} source={o.icon} /> : null}
          <Label pos={pos} i={i} style={labelStyle} text={o.label} />
          {o.badge ? <Badge text={o.badge} on={i === index} /> : null}
        </Tap>
      ))}
    </Well>
  );
}

function Label({ pos, i, style, text }: { pos: SharedValue<number>; i: number; style: object; text: string }) {
  const color = useAnimatedStyle(() => ({
    color: interpolateColor(
      Math.min(1, Math.abs(pos.get() - i)),
      [0, 1],
      [control.segmentedActiveText, control.segmentedInactiveText],
    ),
  }));
  return (
    <Animated.Text style={[style, color]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
      {text}
    </Animated.Text>
  );
}

/** Two tinted copies crossfaded with the plate (tint can't animate on the UI thread). */
function SegIcon({ pos, i, source }: { pos: SharedValue<number>; i: number; source: ImageSource | number }) {
  const on = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.abs(pos.get() - i)) }));
  const off = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(pos.get() - i)) }));
  return (
    <View style={styles.icon}>
      <Animated.View style={[StyleSheet.absoluteFill, off]}>
        <Image source={source} style={styles.icon} contentFit="contain" tintColor={control.segmentedInactiveText} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, on]}>
        <Image source={source} style={styles.icon} contentFit="contain" tintColor={control.segmentedActiveText} />
      </Animated.View>
    </View>
  );
}

function Badge({ text, on }: { text: string; on: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: on ? control.badgeOnActiveBg : control.badgeGoldBg }]}>
      <AppText variant="captionStrong" color={on ? tone.onEmber : tone.gold} style={styles.badgeText} maxFontSizeMultiplier={1.2}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: PAD, borderRadius: radii.lg, alignSelf: 'stretch' },
  plate: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    borderRadius: radii.control,
    backgroundColor: control.segmentedActiveBg,
    boxShadow: [...shadows.segmentedActive],
  },
  plateSoft: { boxShadow: [...shadows.segmentedActiveSoft] },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1.5],
    paddingHorizontal: space[1.5],
  },
  icon: { width: 16, height: 16 },
  badge: { paddingHorizontal: space[1], paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 9, lineHeight: 12 },
});

import { control, layout, radii, shadows } from '@tac/core/tokens';
import { useEffect } from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { feel } from '@/feel';
import { textStyle } from './AppText';
import { useLang } from './lang';
import { segmentedSpring } from './motion';
import { Well } from './Surfaces';
import { Tap } from './Tap';

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** Each tab gets `${testID}-${value}`. */
  testID: string;
  accessibilityLabel: string;
};

const PAD = layout.segmentedTrackPadding;

/**
 * Carved track with one ember plate that slides between tabs (web swaps
 * instantly; a moving plate can't show two half-lit tabs either). The plate
 * position and label colours run on SharedValues; only `value` changes
 * re-render, once per selection.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  testID,
  accessibilityLabel,
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
    const w = innerW.value / n;
    return { width: w, opacity: w > 0 ? 1 : 0, transform: [{ translateX: pos.value * w }] };
  });

  const h = layout.segmentedHeight[size];
  const labelStyle = textStyle(size === 'sm' ? 'segmentedSm' : 'segmented', lang);

  return (
    <Well
      style={styles.track}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => {
        innerW.set(e.nativeEvent.layout.width - PAD * 2);
      }}
    >
      <Animated.View pointerEvents="none" style={[styles.plate, { height: h }, plate]} />
      {options.map((o, i) => (
        <Tap
          key={o.value}
          testID={`${testID}-${o.value}`}
          accessibilityRole="tab"
          accessibilityLabel={o.label}
          accessibilityState={{ selected: i === index }}
          hitSlop={{ top: (44 - h) / 2, bottom: (44 - h) / 2 }}
          style={[styles.tab, { height: h }]}
          onPress={() => {
            if (o.value === value) return;
            go(i);
            feel.emit('segmented');
            onChange(o.value);
          }}
        >
          <Label pos={pos} i={i} style={labelStyle} text={o.label} />
        </Tap>
      ))}
    </Well>
  );
}

function Label({ pos, i, style, text }: { pos: SharedValue<number>; i: number; style: object; text: string }) {
  const color = useAnimatedStyle(() => ({
    color: interpolateColor(
      Math.min(1, Math.abs(pos.value - i)),
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
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});

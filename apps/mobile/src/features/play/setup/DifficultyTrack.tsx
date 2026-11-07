import { BAND_ICON_KEY, DIFFICULTY_BANDS, type BandKey } from '@tac/core/rules';
import { alpha, black, control, eos, graphite, radii, space, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { feel, type FeelEvent } from '@/feel';
import { AppText, textStyle, useLang } from '@/ui';
import { TABULAR } from '../ui';
import { BAND_ICONS } from './bandIcons';

// Play v2 difficulty slider (design PlayV2Casual): one linear track from
// `min` to `max` with an ember fill up to the thumb and a gold "YOU"
// marker at the player's rating. The drag runs on the UI thread and moves
// `live`; React hears the value once, on release.

const THUMB = 18;
/** Last measured track width: a remounted track draws its thumb in place on the first frame. */
let knownWidth = 0;
const THUMB_MS = 90;
const thumbEase = Easing.out(Easing.quad);

export type DifficultyTrackProps = {
  value: number;
  live: SharedValue<number>;
  onChange: (v: number) => void;
  /** The player's rating: the gold marker. */
  me: number;
  min: number;
  max: number;
  step: number;
  youLabel: string;
  easierLabel: string;
  harderLabel: string;
  testID: string;
  accessibilityLabel: string;
};

export function DifficultyTrack({
  value,
  live,
  onChange,
  me,
  min,
  max,
  step,
  youLabel,
  easierLabel,
  harderLabel,
  testID,
  accessibilityLabel,
}: DifficultyTrackProps) {
  const ratio = (v: number) => (Math.min(max, Math.max(min, v)) - min) / (max - min);
  const width = useSharedValue(knownWidth);
  const thumbX = useSharedValue(ratio(value) * knownWidth);
  const committed = useSharedValue(value);
  const mePct = `${ratio(me) * 100}%` as const;

  // External changes (style switch, preset chips) move the thumb.
  useEffect(() => {
    committed.set(value);
    live.set(value);
    const w = width.get();
    if (w > 0) thumbX.set(withTiming(ratio(value) * w, { duration: THUMB_MS, easing: thumbEase }));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    knownWidth = w;
    width.set(w);
    thumbX.set(ratio(committed.get()) * w);
  };

  const emit = (event: FeelEvent) => feel.emit(event);

  const follow = (x: number) => {
    'worklet';
    const w = width.get();
    if (w <= 0) return;
    const px = Math.min(w, Math.max(0, x));
    const raw = min + (px / w) * (max - min);
    const v = Math.min(max, Math.max(min, Math.round(raw / step) * step));
    if (v !== live.get()) {
      live.set(v);
      scheduleOnRN(emit, 'sliderTick');
    }
    thumbX.set(withTiming(((v - min) / (max - min)) * w, { duration: THUMB_MS, easing: thumbEase }));
  };

  const commit = () => {
    'worklet';
    const v = live.get();
    if (v !== committed.get()) {
      committed.set(v);
      scheduleOnRN(onChange, v);
    }
  };

  // Horizontal drags only, so a vertical scroll that starts here scrolls.
  const hitSlop = { top: 10, bottom: 10 };
  const pan = usePanGesture({
    hitSlop,
    activeOffsetX: [-6, 6],
    failOffsetY: [-10, 10],
    onActivate: (e) => {
      'worklet';
      follow(e.x);
    },
    onUpdate: (e) => {
      'worklet';
      follow(e.x);
    },
    onFinalize: () => {
      'worklet';
      commit();
    },
  });
  const tap = useTapGesture({
    hitSlop,
    onActivate: (e) => {
      'worklet';
      follow(e.x);
      commit();
    },
  });
  const gesture = useExclusiveGestures(pan, tap);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: thumbX.get() - THUMB / 2 }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: thumbX.get() }));

  return (
    <View testID={testID}>
      <View style={styles.youRow} pointerEvents="none">
        <View style={[styles.youLabelWrap, { left: mePct }]}>
          <AppText variant="captionStrong" color={tone.gold} style={[styles.youLabel, TABULAR]} testID={`${testID}-you`}>
            {youLabel}
          </AppText>
        </View>
      </View>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.strip}
          onLayout={onLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ min, max, now: value, text: String(value) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const d = e.nativeEvent.actionName === 'increment' ? step * 5 : -step * 5;
            onChange(Math.min(max, Math.max(min, value + d)));
          }}
        >
          <View style={styles.bar} />
          <Animated.View style={[styles.fillWrap, fillStyle]} pointerEvents="none">
            <LinearGradient colors={control.rankProgress} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <View style={[styles.you, { left: mePct }]} pointerEvents="none" />
          <Animated.View style={[styles.thumbWrap, thumbStyle]} pointerEvents="none">
            <LinearGradient
              colors={[tone.onEmber, graphite[300], graphite[500]]}
              locations={[0, 0.55, 1]}
              start={{ x: 0.25, y: 0.07 }}
              end={{ x: 0.75, y: 0.93 }}
              style={styles.thumb}
            />
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.ends}>
        <AppText variant="caption" color={graphite[600]} style={styles.end}>
          {easierLabel}
        </AppText>
        <AppText variant="caption" color={graphite[600]} style={styles.end}>
          {harderLabel}
        </AppText>
      </View>
    </View>
  );
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// A worklet captures its closure when created: keep the table a module const.
const BANDS_MINMAX: [number, number][] = DIFFICULTY_BANDS.map((b) => [b.min, b.max]);

const bandIndexOf = (v: number): number => {
  'worklet';
  for (let i = 0; i < BANDS_MINMAX.length; i++) {
    const [lo, hi] = BANDS_MINMAX[i];
    if (v >= lo && v < hi) return i;
  }
  return BANDS_MINMAX.length - 1;
};

/**
 * The slider's live eye, band and number, drawn on the UI thread (a
 * read-only TextInput fed `text`), so a drag never re-renders the setup.
 */
export function DifficultyReadout({ live, bandLabels }: { live: SharedValue<number>; bandLabels: Record<BandKey, string> }) {
  const { lang } = useLang();
  const labels = DIFFICULTY_BANDS.map((b) => bandLabels[b.key]);
  const valueProps = useAnimatedProps(() => {
    const s = String(live.get());
    return { text: s, defaultValue: s } as object;
  });
  const bandProps = useAnimatedProps(() => {
    const s = labels[bandIndexOf(live.get())];
    return { text: s, defaultValue: s } as object;
  });
  return (
    <View style={styles.readout}>
      <View style={styles.readoutBand}>
        <View style={styles.readoutIcon}>
          {DIFFICULTY_BANDS.map((b, i) => (
            <ReadoutIcon key={b.key} index={i} live={live} icon={BAND_ICONS[BAND_ICON_KEY[b.key]]} />
          ))}
        </View>
        {/* As wide as the longest band name, so the eye never moves as the name changes. */}
        <View>
          {labels.map((l) => (
            <AppText key={l} variant="label" style={[styles.readoutBandText, styles.readoutSizer]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {l}
            </AppText>
          ))}
          <AnimatedTextInput
            editable={false}
            pointerEvents="none"
            animatedProps={bandProps}
            style={[textStyle('label', lang), styles.readoutBandText, StyleSheet.absoluteFill]}
            testID="setup-band"
          />
        </View>
      </View>
      <AnimatedTextInput
        editable={false}
        pointerEvents="none"
        animatedProps={valueProps}
        style={[textStyle('value', lang), styles.readoutValue]}
        testID="setup-rating"
      />
    </View>
  );
}

function ReadoutIcon({ index, live, icon }: { index: number; live: SharedValue<number>; icon: number }) {
  const style = useAnimatedStyle(() => ({ opacity: bandIndexOf(live.get()) === index ? 1 : 0 }));
  return (
    <Animated.View style={[styles.readoutIconLayer, style]}>
      <Image source={icon} style={styles.readoutIconImg} contentFit="contain" transition={null} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  readoutBand: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  readoutIcon: { width: 20, height: 20 },
  readoutIconLayer: { ...StyleSheet.absoluteFill },
  readoutIconImg: { width: 20, height: 20 },
  readoutBandText: { padding: 0, fontSize: 12, textAlign: 'left' },
  readoutSizer: { height: 0, opacity: 0 },
  readoutValue: { padding: 0, height: 30, lineHeight: undefined, minWidth: space[14] },
  youRow: { height: 14 },
  youLabelWrap: { position: 'absolute', top: 0, width: 120, marginLeft: -60, alignItems: 'center' },
  youLabel: { fontSize: 10, lineHeight: 12, letterSpacing: 0.6 },
  strip: { height: 24, justifyContent: 'center' },
  bar: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: eos.well,
    boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: alpha(black, 0.6), inset: true }],
  },
  fillWrap: { position: 'absolute', left: 0, top: 9, height: 6, borderRadius: radii.full, overflow: 'hidden' },
  you: { position: 'absolute', top: 3, width: 2, height: 18, marginLeft: -1, borderRadius: 1, backgroundColor: tone.gold },
  thumbWrap: {
    position: 'absolute',
    left: 0,
    top: 3,
    width: THUMB,
    height: THUMB,
    borderRadius: radii.full,
    boxShadow: [
      { offsetX: 0, offsetY: 1, blurRadius: 3, spreadDistance: 0, color: alpha(black, 0.7) },
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 4, color: alpha(eos.ember, 0.25) },
    ],
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: radii.full },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[0.5] },
  end: { fontSize: 10, lineHeight: 12, fontWeight: '700' },
});

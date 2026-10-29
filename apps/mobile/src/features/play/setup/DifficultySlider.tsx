import { BAND_ICON_KEY, DIFFICULTY_BANDS, bandFor, type BandIconKey, type BandKey } from '@tac/core/rules';
import { alpha, black, control, easing, eos, graphite, radii, rank, space, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { feel, type FeelEvent } from '@/feel';
import { AppText, textStyle, useLang } from '@/ui';
import { Tap } from '@/ui/Tap';
import { colorsTiming } from '@/ui/motion';

// DifficultySlider v1 (PLAN §5 Phase 2), a port of the web
// components/DifficultySlider.tsx. The drag runs on the UI thread: the
// thumb, the fill, the zone colours, the band eyes and the readout all
// follow the `live` SharedValue; React hears the value once, on release.

export const BAND_ICONS: Record<BandIconKey, number> = {
  'tomoe-1': require('../../../../assets/icons/tomoe-1.webp'),
  'tomoe-2': require('../../../../assets/icons/tomoe-2.webp'),
  'tomoe-3': require('../../../../assets/icons/tomoe-3.webp'),
  'rank-4': require('../../../../assets/icons/rank-4.webp'),
  'rank-5': require('../../../../assets/icons/rank-5.webp'),
};

/** Finger within this many px of a checkpoint lands exactly on it (web SNAP_PX). */
const SNAP_PX = 14;
/** web thumb `transition: left 90ms ease-out`. */
const THUMB_MS = 90;
const thumbEase = Easing.bezier(...easing.easeOut);
/** Locked-cap rubber band: the thumb follows 30 % of the overshoot, at most 24 px. */
const RUBBER = 0.3;
const RUBBER_MAX = 24;
const RUBBER_SPRING = { damping: 18, stiffness: 260 };
/** Design v2 thumb: 18 pt bone-to-graphite bead with a 4 pt ember ring. */
const THUMB = 18;
/** The touch strip around the bar: lock disc (22) is the tallest layer. */
const TRACK_H = 24;
const BAR_H = 8;
const BAR_TOP = (TRACK_H - BAR_H) / 2;
const EYE_ROW = 36;
const EYE_ON = 34;
const EYE_OFF = 24;

/** Equal track slices per band, so the thumb sits above its eye (web bandEdges). */
function bandEdges(min: number, max: number): number[] {
  const inner = DIFFICULTY_BANDS.map((b) => b.min).filter((v) => v > min && v < max);
  return [min, ...inner, max];
}

function valueToPct(v: number, e: number[]): number {
  'worklet';
  const n = e.length - 1;
  if (v <= e[0]) return 0;
  if (v >= e[n]) return 100;
  for (let i = 0; i < n; i++) {
    if (v < e[i + 1]) return ((i + (v - e[i]) / (e[i + 1] - e[i])) / n) * 100;
  }
  return 100;
}

function pctToValue(p: number, e: number[]): number {
  'worklet';
  const n = e.length - 1;
  const x = (Math.min(100, Math.max(0, p)) / 100) * n;
  const i = Math.min(n - 1, Math.floor(x));
  return e[i] + (x - i) * (e[i + 1] - e[i]);
}

// A worklet captures its closure when its function object is created: a
// hoisted declaration would capture this table before it is initialised.
const DIFFICULTY_BANDS_MINMAX: [number, number][] = DIFFICULTY_BANDS.map((b) => [b.min, b.max]);

const bandIndexOf = (v: number): number => {
  'worklet';
  for (let i = 0; i < DIFFICULTY_BANDS_MINMAX.length; i++) {
    const [lo, hi] = DIFFICULTY_BANDS_MINMAX[i];
    if (v >= lo && v < hi) return i;
  }
  return DIFFICULTY_BANDS_MINMAX.length - 1;
};

export type DifficultySliderProps = {
  /** Committed value (React). */
  value: number;
  /** Live value while dragging (UI thread); the parent's readout follows it. */
  live: SharedValue<number>;
  /** Fired once per gesture (release / eye tap), not per step. */
  onChange: (v: number) => void;
  cap: number;
  min?: number;
  max?: number;
  step?: number;
  /** Start of the level-up zone (norm − 50); enables zones + magnets. */
  levelUpFrom?: number;
  norm?: number;
  bandLabels: Record<BandKey, string>;
  testID: string;
  accessibilityLabel: string;
};

export function DifficultySlider({
  value,
  live,
  onChange,
  cap,
  min = 400,
  max = 3000,
  step = 25,
  levelUpFrom,
  norm,
  bandLabels,
  testID,
  accessibilityLabel,
}: DifficultySliderProps) {
  const edges = bandEdges(min, max);
  const pct = (v: number) => valueToPct(v, edges);
  const zones = levelUpFrom != null && levelUpFrom < cap;
  const zoneFrom = zones ? Math.max(min, levelUpFrom) : null;
  const checkpoints = zones
    ? Array.from(new Set([Math.max(min, levelUpFrom), norm, cap].filter((v): v is number => v != null && v >= min && v <= cap)))
    : [];
  const capPct = pct(cap);

  const width = useSharedValue(0);
  const thumbX = useSharedValue(0);
  /** Finger past the locked cap (rubber band engaged, sliderCap sent). */
  const atCap = useSharedValue(false);
  const committed = useSharedValue(value);

  // External changes (style switch, band eye, off-form CTA) move the thumb.
  useEffect(() => {
    committed.set(value);
    live.set(value);
    const w = width.get();
    if (w > 0) thumbX.set(withTiming((valueToPct(value, edges) / 100) * w, { duration: THUMB_MS, easing: thumbEase }));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    width.set(w);
    // `committed`, not `live`: on a remount (style / mode switch) the first
    // layout can land before the effects that sync `live`, which still holds
    // the previous style's value, and the thumb was drawn there.
    thumbX.set((valueToPct(committed.get(), edges) / 100) * w);
  };

  const emit = (event: FeelEvent) => feel.emit(event);

  const setLive = (v: number, kind: FeelEvent | null) => {
    'worklet';
    if (v === live.get()) return;
    live.set(v);
    if (kind) scheduleOnRN(emit, kind);
  };

  const follow = (x: number) => {
    'worklet';
    const w = width.get();
    if (w <= 0) return;
    const capX = (capPct / 100) * w;
    // Locked region: rubber band at the cap, one warning on entry.
    if (capPct < 100 && x > capX + SNAP_PX) {
      const over = Math.min(RUBBER_MAX, (x - capX) * RUBBER);
      thumbX.set(capX + over);
      setLive(cap, null);
      if (!atCap.get()) {
        atCap.set(true);
        scheduleOnRN(emit, 'sliderCap');
      }
      return;
    }
    atCap.set(false);
    const px = Math.min(w, Math.max(0, x));
    // Magnet: close enough to a zone checkpoint lands exactly on it.
    for (let i = 0; i < checkpoints.length; i++) {
      const c = checkpoints[i];
      const cx = (valueToPct(c, edges) / 100) * w;
      if (Math.abs(cx - px) <= SNAP_PX) {
        setLive(c, 'sliderDetent');
        thumbX.set(withTiming(cx, { duration: THUMB_MS, easing: thumbEase }));
        return;
      }
    }
    const raw = pctToValue((px / w) * 100, edges);
    const v = Math.min(cap, Math.max(min, Math.round(raw / step) * step));
    setLive(v, 'sliderTick');
    thumbX.set(withTiming((valueToPct(v, edges) / 100) * w, { duration: THUMB_MS, easing: thumbEase }));
  };

  const commit = () => {
    'worklet';
    const w = width.get();
    if (atCap.get()) {
      atCap.set(false);
      thumbX.set(withSpring((capPct / 100) * w, RUBBER_SPRING));
    }
    const v = live.get();
    if (v !== committed.get()) {
      committed.set(v);
      scheduleOnRN(onChange, v);
    }
  };

  // fix (Phase 5): the drag activates on horizontal movement only and
  // fails on vertical, so a scroll that starts on the slider scrolls the
  // setup instead of dragging the thumb; a plain tap still jumps there.
  // The strip is 24 pt tall: grow the touch area down over the numbers.
  const hitSlop = { top: 6, bottom: 16 };
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

  // Settled band (React side) for the number row; the eyes follow the drag.
  const settledBand = bandIndexOf(value);
  const fillColors = zones ? control.rankProgress : ([eos.seam, eos.dust] as const);

  return (
    <View testID={testID}>
      <View style={styles.eyes}>
        {DIFFICULTY_BANDS.map((b, i) => (
          <BandEye
            key={b.key}
            index={i}
            live={live}
            locked={b.min >= cap}
            icon={BAND_ICONS[BAND_ICON_KEY[b.key]]}
            label={bandLabels[b.key]}
            onPress={() => {
              const mid = (Math.max(b.min, min) + Math.min(b.max, max)) / 2;
              const v = Math.min(cap, Math.max(min, Math.round(mid / step) * step));
              if (v !== value) onChange(v);
            }}
          />
        ))}
      </View>

      <GestureDetector gesture={gesture}>
        <View
          style={styles.track}
          onLayout={onLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          // iOS reads a bare min/max/now as a percentage: say the rating and its band.
          accessibilityValue={{ min, max: cap, now: value, text: `${value}, ${bandLabels[bandFor(value).key]}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const d = e.nativeEvent.actionName === 'increment' ? step : -step;
            onChange(Math.min(cap, Math.max(min, value + d)));
          }}
        >
          {/* One carved slice per band, each filled by the thumb. */}
          <View style={styles.bar}>
            {DIFFICULTY_BANDS.map((b, i) => (
              <BandSlice key={b.key} index={i} count={DIFFICULTY_BANDS.length} thumbX={thumbX} width={width} capPct={capPct} colors={fillColors} />
            ))}
          </View>
          {DIFFICULTY_BANDS.slice(1).map((b, i) => (
            <View key={b.key} style={[styles.divider, { left: `${((i + 1) / DIFFICULTY_BANDS.length) * 100}%` }]} />
          ))}
          {zoneFrom != null && (
            <View style={[styles.zone, { left: `${pct(zoneFrom)}%`, width: `${Math.max(0, capPct - pct(zoneFrom))}%` }]} />
          )}
          {capPct < 100 && (
            <>
              <View style={[styles.locked, { left: `${capPct}%` }]} />
              <View style={[styles.lock, { left: `${capPct}%` }]}>
                <Lock size={10} color={eos.ash} strokeWidth={2.6} />
              </View>
            </>
          )}
          <Animated.View style={[styles.thumbWrap, thumbStyle]} pointerEvents="none">
            {/* linear-gradient(150deg, #f5eee5 0%, #cbc5bf 55%, #807c81 100%) */}
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

      <View style={styles.numbers}>
        {DIFFICULTY_BANDS.map((b, i) => (
          <View key={b.key} style={styles.numberCell}>
            <AppText
              variant="caption"
              color={i === settledBand ? eos.bone : b.min >= cap ? tone.lockRim : eos.dust}
              style={[styles.number, i > 0 && styles.numberShift]}
            >
              {String(Math.max(b.min, min))}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** One band's slice of the bar: filled up to the thumb (and never past the lock). */
function BandSlice({
  index,
  count,
  thumbX,
  width,
  capPct,
  colors,
}: {
  index: number;
  count: number;
  thumbX: SharedValue<number>;
  width: SharedValue<number>;
  capPct: number;
  colors: readonly [string, string, ...string[]];
}) {
  const fill = useAnimatedStyle(() => {
    const w = width.get();
    const slice = w / count;
    const x = Math.min(thumbX.get(), (capPct / 100) * w);
    const f = slice > 0 ? Math.min(1, Math.max(0, (x - index * slice) / slice)) : 0;
    return { width: `${f * 100}%` };
  });
  const round = index === 0 ? styles.sliceFirst : index === count - 1 ? styles.sliceLast : null;
  return (
    <View style={[styles.slice, round]}>
      <Animated.View style={[styles.sliceFill, fill]}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

function BandEye({
  index,
  live,
  locked,
  icon,
  label,
  onPress,
}: {
  index: number;
  live: SharedValue<number>;
  locked: boolean;
  icon: number;
  label: string;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const band = bandIndexOf(live.get());
    const active = band === index;
    const opacity = active ? 1 : locked ? 0.35 : index < band ? 0.85 : 0.55;
    return {
      opacity: withTiming(opacity, colorsTiming),
      transform: [{ scale: withTiming(active ? 1 : EYE_OFF / EYE_ON, colorsTiming) }],
    };
  });
  return (
    <View style={styles.eyeCell}>
      <Tap
        testID={`slider-band-${index}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={locked}
        onPress={onPress}
        pressFeel="sliderTick"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Animated.View style={[styles.eye, style]}>
          <Image source={icon} style={styles.eyeIcon} contentFit="contain" transition={null} />
        </Animated.View>
      </Tap>
    </View>
  );
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * The slider's live number and band, drawn on the UI thread (Reanimated's
 * own PerformanceMonitor pattern: a read-only TextInput fed `text`), so a
 * drag never re-renders the setup screen.
 */
export function SliderReadout({ live, bandLabels, provisional }: { live: SharedValue<number>; bandLabels: Record<BandKey, string>; provisional: boolean }) {
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
        {DIFFICULTY_BANDS.map((b, i) => (
          <ReadoutIcon key={b.key} index={i} live={live} icon={BAND_ICONS[BAND_ICON_KEY[b.key]]} />
        ))}
        <AnimatedTextInput
          editable={false}
          pointerEvents="none"
          animatedProps={bandProps}
          style={[textStyle('label', lang), styles.readoutBandText]}
          testID="setup-band"
        />
      </View>
      <AnimatedTextInput
        editable={false}
        pointerEvents="none"
        animatedProps={valueProps}
        style={[textStyle('value', lang), styles.readoutValue]}
        testID="setup-rating"
      />
      {provisional && (
        <AppText variant="value" color={rank.intermediate.color}>
          {'?'}
        </AppText>
      )}
    </View>
  );
}

function ReadoutIcon({ index, live, icon }: { index: number; live: SharedValue<number>; icon: number }) {
  const style = useAnimatedStyle(() => ({ opacity: bandIndexOf(live.get()) === index ? 1 : 0 }));
  return (
    <Animated.View style={[styles.readoutIcon, style]}>
      <Image source={icon} style={styles.readoutIconImg} contentFit="contain" transition={null} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // The bar sits in a 24 pt strip (the lock disc's height); the pan's
  // hitSlop grows the touch area to the eyes and the numbers.
  track: { height: TRACK_H, marginTop: 10 - BAR_TOP },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: BAR_TOP,
    height: BAR_H,
    flexDirection: 'row',
  },
  slice: {
    flex: 1,
    height: BAR_H,
    backgroundColor: eos.well,
    overflow: 'hidden',
    boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: alpha(black, 0.6), inset: true }],
  },
  sliceFirst: { borderTopLeftRadius: radii.full, borderBottomLeftRadius: radii.full },
  sliceLast: { borderTopRightRadius: radii.full, borderBottomRightRadius: radii.full },
  sliceFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  divider: {
    position: 'absolute',
    top: BAR_TOP - 2,
    width: 2,
    height: 12,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: tone.tick,
  },
  // Level-up zone: a gold outline from the floor to the lock.
  zone: {
    position: 'absolute',
    top: BAR_TOP - 3,
    height: 14,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: alpha(tone.gold, 0.75),
  },
  locked: {
    position: 'absolute',
    right: 0,
    top: BAR_TOP - 1,
    height: 10,
    borderTopRightRadius: radii.full,
    borderBottomRightRadius: radii.full,
    backgroundColor: alpha(black, 0.72),
  },
  lock: {
    position: 'absolute',
    top: (TRACK_H - 22) / 2,
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: radii.full,
    backgroundColor: eos.well,
    borderWidth: 1,
    borderColor: tone.lockRim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 0 1px 3px black/70 + a 4 pt ember/25 ring (box-shadow spread).
  thumbWrap: {
    position: 'absolute',
    left: 0,
    top: (TRACK_H - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: radii.full,
    boxShadow: [
      { offsetX: 0, offsetY: 1, blurRadius: 3, spreadDistance: 0, color: alpha(black, 0.7) },
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 4, color: alpha(eos.ember, 0.25) },
    ],
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: radii.full },
  eyes: { flexDirection: 'row', paddingTop: 2 },
  eyeCell: { flex: 1, height: EYE_ROW, alignItems: 'center', justifyContent: 'flex-end' },
  // Drawn at the current-band size and scaled down for the others, bottom-anchored.
  eye: { width: EYE_ON, height: EYE_ON, transformOrigin: 'bottom' },
  eyeIcon: { width: EYE_ON, height: EYE_ON },
  numbers: { flexDirection: 'row', marginTop: 8 - BAR_TOP },
  numberCell: { flex: 1 },
  number: { fontSize: 10, lineHeight: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  numberShift: { marginLeft: -12 },
  readout: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  readoutBand: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  readoutIcon: { position: 'absolute', left: 0, width: 18, height: 18 },
  readoutIconImg: { width: 18, height: 18 },
  // `.lbl` at 12 px (the class keeps its 1.32 px tracking).
  readoutBandText: { paddingLeft: 18 + space[2], padding: 0, fontSize: 12, minWidth: space[20] },
  // A single-line TextInput centres its text in `height` (lineHeight would pin it to the top).
  readoutValue: { padding: 0, height: 28, lineHeight: undefined, minWidth: space[14] },
});

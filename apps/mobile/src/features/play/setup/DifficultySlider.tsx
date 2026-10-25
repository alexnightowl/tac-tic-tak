import { BAND_ICON_KEY, DIFFICULTY_BANDS, bandFor, type BandIconKey, type BandKey } from '@tac/core/rules';
import { control, easing, eos, feedback, graphite, radii, rank, semantic, shadows, space, surface, text } from '@tac/core/tokens';
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
const THUMB = 24;
const TRACK_H = 36;

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
  currentRating?: number | null;
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
  currentRating,
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
  const levelUp = zones ? levelUpFrom : min;

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
  const pan = usePanGesture({
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
    onActivate: (e) => {
      'worklet';
      follow(e.x);
      commit();
    },
  });
  const gesture = useExclusiveGestures(pan, tap);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: thumbX.get() - THUMB / 2 }] }));
  const fillStyle = useAnimatedStyle(() => ({
    width: Math.min(thumbX.get(), (capPct / 100) * width.get()),
  }));
  const levelUpFill = useAnimatedStyle(() => ({ opacity: live.get() >= levelUp ? 1 : 0 }));
  const haloStyle = useAnimatedStyle(() => ({
    backgroundColor: live.get() >= levelUp ? semantic.accentSoft : semantic.borderStrong,
  }));

  return (
    <View testID={testID}>
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
          <View style={styles.rail} />
          {zoneFrom != null && (
            <View style={[styles.zone, { left: `${pct(zoneFrom)}%`, width: `${Math.max(0, capPct - pct(zoneFrom))}%` }]} />
          )}
          <Animated.View style={[styles.fill, fillStyle]}>
            <LinearGradient colors={[eos.seam, eos.dust]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Animated.View style={[StyleSheet.absoluteFill, levelUpFill]}>
              <LinearGradient colors={control.rankProgress} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </Animated.View>
          {checkpoints
            .filter((c) => c !== cap && c !== norm)
            .map((c) => (
              <View key={c} style={[styles.tick, { left: `${pct(c)}%` }]} />
            ))}
          {capPct < 100 && (
            <>
              <View style={[styles.locked, { left: `${capPct}%` }]} />
              <View style={[styles.lock, { left: `${capPct}%` }]}>
                <Lock size={10} color={graphite[400]} />
              </View>
            </>
          )}
          {currentRating != null && <CurrentMarker leftPct={pct(currentRating)} live={live} edges={edges} />}
          <Animated.View style={[styles.thumbWrap, thumbStyle]} pointerEvents="none">
            <Animated.View style={[styles.halo, haloStyle]} />
            <LinearGradient
              colors={[semantic.accentContrast, graphite[300], graphite[500]]}
              start={{ x: 0.3, y: 0.2 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.thumb}
            />
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.eyes}>
        {DIFFICULTY_BANDS.map((b, i) => (
          <BandEye
            key={b.key}
            index={i}
            live={live}
            locked={b.min > cap}
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

      <View style={styles.anchors}>
        {anchorLabels(min, cap, zoneFrom, pct).map(({ v, gold }) => (
          <View key={`${v}-${gold}`} style={[styles.anchor, { left: `${pct(v)}%`, marginLeft: -(ANCHOR_W * pct(v)) / 100 }]}>
            <AppText variant="caption" color={gold ? rank.intermediate.color : eos.dust} style={[styles.anchorText, { textAlign: pct(v) > 90 ? 'right' : pct(v) < 10 ? 'left' : 'center' }]}>
              {String(v)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** web "you are here" marker; hidden when the thumb sits on it. */
function CurrentMarker({ leftPct, live, edges }: { leftPct: number; live: SharedValue<number>; edges: number[] }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.abs(valueToPct(live.get(), edges) - leftPct) > 1 ? 0.8 : 0 }));
  return <Animated.View pointerEvents="none" style={[styles.current, { left: `${leftPct}%` }, style]} />;
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
    const active = bandIndexOf(live.get()) === index;
    return {
      opacity: withTiming(active ? 1 : locked ? 0.25 : 0.5, colorsTiming),
      transform: [{ scale: withTiming(active ? 1.15 : 1, colorsTiming) }],
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

const ANCHOR_W = 44;

/** min · zone start · cap, dropping the zone label when it would collide (web anchorLabels). */
function anchorLabels(min: number, cap: number, zoneFrom: number | null, pct: (v: number) => number) {
  const out: { v: number; gold: boolean }[] = [{ v: min, gold: false }];
  if (zoneFrom != null && zoneFrom > min) {
    const zp = pct(zoneFrom);
    if (zp - pct(min) > 9 && pct(cap) - zp > 9) out.push({ v: zoneFrom, gold: true });
  }
  out.push({ v: cap, gold: false });
  return out;
}

const RAIL = 6;
const railTop = (TRACK_H - RAIL) / 2;

const styles = StyleSheet.create({
  track: { height: TRACK_H, justifyContent: 'center' },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: railTop,
    height: RAIL,
    borderRadius: radii.full,
    backgroundColor: eos.well,
    boxShadow: [...shadows.well],
  },
  zone: {
    position: 'absolute',
    top: railTop,
    height: RAIL,
    borderRadius: radii.full,
    backgroundColor: rank.intermediate.glow,
    borderWidth: 1,
    borderColor: feedback.normGold,
  },
  fill: { position: 'absolute', left: 0, top: railTop, height: RAIL, borderRadius: radii.full, overflow: 'hidden' },
  tick: {
    position: 'absolute',
    top: (TRACK_H - 14) / 2,
    width: 3,
    height: 14,
    marginLeft: -1.5,
    borderRadius: radii.full,
    backgroundColor: rank.intermediate.color,
  },
  locked: {
    position: 'absolute',
    right: 0,
    top: (TRACK_H - 8) / 2,
    height: 8,
    borderTopRightRadius: radii.full,
    borderBottomRightRadius: radii.full,
    backgroundColor: surface.backdrop,
  },
  lock: {
    position: 'absolute',
    top: (TRACK_H - 20) / 2,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: radii.full,
    backgroundColor: eos.well,
    borderWidth: 1,
    borderColor: eos.seam,
    alignItems: 'center',
    justifyContent: 'center',
  },
  current: {
    position: 'absolute',
    top: (TRACK_H - 16) / 2,
    width: 3,
    height: 16,
    marginLeft: -1.5,
    borderRadius: radii.full,
    backgroundColor: eos.bone,
  },
  thumbWrap: { position: 'absolute', left: 0, top: (TRACK_H - THUMB) / 2, width: THUMB, height: THUMB },
  halo: { position: 'absolute', left: -4, top: -4, width: THUMB + 8, height: THUMB + 8, borderRadius: radii.full },
  thumb: { width: THUMB, height: THUMB, borderRadius: radii.full, boxShadow: [...shadows.toggleThumb] },
  eyes: { flexDirection: 'row', marginTop: space[2] },
  eyeCell: { flex: 1, alignItems: 'center' },
  eye: { width: space[8], height: space[8], alignItems: 'center', justifyContent: 'center' },
  eyeIcon: { width: space[6], height: space[6] },
  anchors: { height: space[4], marginTop: space[1] },
  anchor: { position: 'absolute', width: ANCHOR_W },
  anchorText: { fontSize: text.caption.fontSize - 2 },
  readout: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  readoutBand: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  readoutIcon: { position: 'absolute', left: 0, width: 18, height: 18 },
  readoutIconImg: { width: 18, height: 18 },
  readoutBandText: { paddingLeft: 18 + space[1.5], padding: 0, minWidth: space[20] },
  readoutValue: { padding: 0, minWidth: space[14] },
});

import { formatSessionTime, type SessionRow as Row } from '@tac/core/format';
import { isTrainingStyle } from '@tac/core/rules';
import { eos, radii, shadows, space, surface, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Trash2 } from 'lucide-react-native';
import { useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { feel } from '@/feel';
import { AppText, fontFamily } from '@/ui';
import type { TFn } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { crossfadeTiming, swipeSpring } from '@/features/review/motion';
import { pct, responseTime, sessionThemeLabel } from './format';

/** Delete action width (web REVEAL = 88). */
export const REVEAL = 88;
/** Release past this opens the action; crossing it buzzes Medium (web snap point 44). */
export const SNAP = REVEAL / 2;
/** A long swipe past this deletes at once (iOS full swipe). */
const FULL = REVEAL * 2.2;

const STYLE_ICONS = {
  bullet: require('../../../assets/icons/mode-bullet.webp'),
  blitz: require('../../../assets/icons/mode-blitz.webp'),
  rapid: require('../../../assets/icons/mode-rapid.webp'),
} as const;

/**
 * History row (web SessionList SessionRowCard). Swipe-to-delete only when
 * `onDelete` is given — fix: the web passed a no-op onDelete on other
 * users' profiles, so the swipe showed there and did nothing. The drag
 * runs on SharedValues only; JS hears the threshold tick and the delete.
 */
export function SessionRow({ row, lang, t, onDelete }: { row: Row; lang: 'en' | 'uk'; t: TFn; onDelete?: (id: string) => void }) {
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const past = useSharedValue(false);
  const gone = useSharedValue(false);

  // FlashList recycles rows: a cell that showed an open or deleted row
  // must come back closed for the next one (and for an undone delete).
  useLayoutEffect(() => {
    x.set(0);
    past.set(false);
    gone.set(false);
  }, [row.id, x, past, gone]);

  const remove = () => onDelete?.(row.id);

  const pan = usePanGesture({
    enabled: !!onDelete,
    activeOffsetX: [-10, 10],
    failOffsetY: [-10, 10],
    onBegin: () => {
      'worklet';
      start.set(x.get());
    },
    onUpdate: (e) => {
      'worklet';
      if (gone.get()) return;
      const raw = start.get() + e.translationX;
      // Free to the left, rubber-banded past the open position and to the right.
      const v = raw > 0 ? raw * 0.15 : raw < -REVEAL ? -REVEAL + (raw + REVEAL) * 0.6 : raw;
      x.set(v);
      const beyond = v < -SNAP;
      if (beyond !== past.get()) {
        past.set(beyond);
        // Medium at the threshold (PLAN Phase 6); no feel event of its own yet.
        if (beyond) scheduleOnRN(feel.emit, 'sliderDetent');
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (gone.get()) return;
      const v = x.get();
      if (v < -FULL || (v < -REVEAL && e.velocityX < -1200)) {
        gone.set(true);
        x.set(withTiming(-REVEAL * 5, crossfadeTiming, () => {
          'worklet';
          scheduleOnRN(remove);
        }));
        return;
      }
      x.set(withSpring(v < -SNAP ? -REVEAL : 0, swipeSpring));
      past.set(v < -SNAP);
    },
  });

  const cardStyle = useAnimatedStyle(() => {
    // The right corners square off as the action slides in (web radius morph).
    const r = interpolate(x.get(), [-REVEAL, 0], [0, radii['2xl']], 'clamp');
    return { transform: [{ translateX: x.get() }], borderTopRightRadius: r, borderBottomRightRadius: r };
  });
  const actionStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-28, 0], [1, 0], 'clamp') }));

  const open = () => {
    // A tap on an open row closes it instead of navigating (web).
    if (x.get() < -1) {
      x.set(withSpring(0, swipeSpring));
      past.set(false);
      return;
    }
    router.push(`/sessions/${encodeURIComponent(row.id)}` as Href);
  };

  const del = () => {
    gone.set(true);
    x.set(withTiming(-REVEAL * 5, crossfadeTiming, () => {
      'worklet';
      scheduleOnRN(remove);
    }));
  };

  const delta = row.peakRating - row.startRating;
  const deltaColor = delta > 0 ? eos.sage : delta < 0 ? eos.rose : eos.ash;
  const time = formatSessionTime(row.startedAt, lang);
  const style = row.style && isTrainingStyle(row.style) ? row.style : null;
  const sub = [
    sessionThemeLabel(row.theme, lang, t('sessions.mixed')),
    pct(row.accuracy),
    responseTime(row.avgResponseMs),
    t('sessions.minutes', { n: Math.round(row.durationSec / 60) }),
  ].join(' · ');

  return (
    <View style={styles.wrap} testID={`history-row-${row.id}`}>
      {onDelete ? (
        <Animated.View style={[styles.action, actionStyle]}>
          <Tap testID={`history-delete-${row.id}`} accessibilityRole="button" accessibilityLabel={t('sessions.delete_a11y')} onPress={del} style={styles.actionTap}>
            <Trash2 size={18} color={tone.onEmber} />
            <AppText variant="caption" color={tone.onEmber}>
              {t('sessions.delete')}
            </AppText>
          </Tap>
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Tap
            testID={`history-open-${row.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('sessions.row_a11y', { time, solved: row.solved, start: row.startRating, peak: row.peakRating })}
            onPress={open}
            style={styles.inner}
          >
            {style ? (
              <View style={styles.styleTile}>
                <Image source={STYLE_ICONS[style]} style={styles.styleIcon} tintColor={eos.ash} contentFit="contain" transition={null} />
              </View>
            ) : null}
            <View style={styles.left}>
              <AppText variant="caption" style={styles.tabular}>
                {time}
              </AppText>
              <AppText variant="timer" style={styles.solved}>
                {String(row.solved)}
              </AppText>
              <AppText variant="caption" numberOfLines={1} adjustsFontSizeToFit style={styles.solvedLabel}>
                {t('sessions.row_solved')}
              </AppText>
            </View>
            <View style={styles.mid}>
              <View style={styles.ratingLine}>
                <AppText variant="body" color={eos.ash} style={styles.tabular}>
                  {String(row.startRating)}
                </AppText>
                <ChevronRight size={12} color={eos.dust} />
                <AppText variant="body" color={delta === 0 ? eos.bone : deltaColor} style={[styles.tabular, { fontFamily: fontFamily(lang, 'sans', 700) }]}>
                  {String(row.peakRating)}
                </AppText>
                {delta !== 0 ? (
                  <View style={styles.delta}>
                    {delta > 0 ? <ArrowUpRight size={12} color={deltaColor} /> : <ArrowDownRight size={12} color={deltaColor} />}
                    <AppText variant="caption" color={deltaColor} style={styles.tabular}>
                      {`${delta > 0 ? '+' : ''}${delta}`}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <AppText variant="caption" numberOfLines={1}>
                {sub}
              </AppText>
            </View>
          </Tap>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  action: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: REVEAL,
    backgroundColor: eos.ember,
    borderTopRightRadius: radii['2xl'],
    borderBottomRightRadius: radii['2xl'],
  },
  actionTap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[1] },
  card: {
    backgroundColor: surface.card,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: surface.cardBorder,
    boxShadow: [...shadows.card],
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3] },
  styleTile: { width: space[9], height: space[9], borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: eos.rise },
  styleIcon: { width: space[5], height: space[5] },
  left: { width: space[12] + space[2], alignItems: 'center' },
  solved: { marginTop: space[0.5] },
  solvedLabel: { maxWidth: space[12] + space[2] },
  mid: { flex: 1, minWidth: 0, gap: space[0.5] },
  ratingLine: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  delta: { flexDirection: 'row', alignItems: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
});

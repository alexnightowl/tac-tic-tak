import { control, eos, layout, radii, semantic, space, surface } from '@tac/core/tokens';
import { Check, Eye, EyeOff, XCircle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/ui';
import { useT, type TFn } from '@/ui/lang';
import type { BlindDirector, BlindView } from './director';
import { localSan } from './san';
import { useLook } from './useLook';

/**
 * Phone runner, blind session: the status capsule (the look's countdown,
 * the opponent's reply in text, the result) and Peek (hold to look; a tap
 * shows the pieces for 1.5 s).
 */
export function BlindBar({ view, director }: { view: BlindView; director: BlindDirector }) {
  const t = useT();
  const canPeek = view.stage === 'hidden';
  return (
    <View style={styles.row} testID="blind-bar">
      <View style={styles.status}>
        <BlindStatus view={view} t={t} />
      </View>
      <PeekButton director={director} enabled={canPeek} peeking={view.peeking} label={t('blind.runner.peek')} a11y={t('blind.runner.peek_a11y')} />
    </View>
  );
}

/** Hold to look (at least 1.5 s); RNGH tap with touch-down and release on the UI thread. */
function PeekButton({ director, enabled, peeking, label, a11y }: { director: BlindDirector; enabled: boolean; peeking: boolean; label: string; a11y: string }) {
  const start = () => director.peekStart(true);
  const gesture = useTapGesture({
    enabled,
    maxDuration: 60_000,
    onBegin: () => {
      'worklet';
      scheduleOnRN(start);
    },
    onFinalize: () => {
      'worklet';
      scheduleOnRN(director.peekEnd);
    },
  });
  return (
    <GestureDetector gesture={gesture}>
      <View
        testID="blind-peek"
        accessible
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ disabled: !enabled }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'activate' && enabled) director.peekStart(false);
        }}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={[styles.peek, peeking && styles.peekOn, !enabled && styles.disabled]}
      >
        <Eye size={16} color={peeking ? eos.ember : eos.bone} />
        <AppText variant="label" color={eos.bone}>
          {label}
        </AppText>
      </View>
    </GestureDetector>
  );
}

function BlindStatus({ view, t }: { view: BlindView; t: TFn }) {
  if (view.stage === 'setup' || view.stage === 'preview') return <Look view={view} t={t} />;
  if (view.stage === 'revealed') {
    const ok = view.result === 'solved';
    return (
      <View style={styles.line} testID="blind-status">
        {ok ? <Check size={16} color={eos.sage} strokeWidth={2.4} /> : <XCircle size={16} color={eos.rose} />}
        <AppText variant="bodyStrong" color={ok ? eos.sage : eos.bone} numberOfLines={1} style={styles.flex}>
          {t(ok ? 'blind.runner.solved' : 'blind.runner.missed')}
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.line} testID="blind-status" accessibilityLiveRegion="polite">
      <EyeOff size={16} color={eos.ash} />
      <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex} testID="blind-reply">
        {view.reply ? t('blind.runner.reply', { san: localSan(view.reply, t) }) : t('blind.runner.from_memory')}
      </AppText>
    </View>
  );
}

/** "Memorize · 4" with the look draining under it (re-renders itself once a second). */
function Look({ view, t }: { view: BlindView; t: TFn }) {
  const { secs, drain } = useLook(view);
  const fill = useAnimatedStyle(() => ({ width: `${drain.get() * 100}%` }));
  return (
    <View style={styles.look} testID="blind-status" accessible accessibilityLabel={t('blind.runner.memorize_a11y', { n: secs })}>
      <View style={styles.line}>
        <Eye size={16} color={eos.ember} />
        <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1} testID="blind-countdown">
          {t('blind.runner.memorize', { n: secs })}
        </AppText>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fill]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: space[2] },
  flex: { flex: 1, minWidth: 0 },
  status: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    minHeight: layout.inputHeight,
    borderRadius: radii.xl,
    backgroundColor: surface.floatCard,
    borderWidth: 1,
    borderColor: surface.cardBorder,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  look: { gap: space[1.5] },
  track: { height: 3, borderRadius: radii.full, backgroundColor: control.chipBg, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.full, backgroundColor: eos.ember },
  peek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    paddingHorizontal: space[3.5],
    minHeight: layout.inputHeight,
    borderRadius: radii.xl,
    backgroundColor: surface.floatCard,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
  },
  peekOn: { borderColor: eos.ember },
  disabled: { opacity: 0.45 },
});

import { alpha, eos, tone } from '@tac/core/tokens';
import { Check, Eye, EyeOff, XCircle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { BlindDirector, BlindView } from '@/features/play/blind/director';
import { localSan } from '@/features/play/blind/san';
import { useLook } from '@/features/play/blind/useLook';
import { plural } from '@/features/offline/format';
import { useT, useTn, type TFn } from '@/ui/lang';
import { DText, GhostButton, Kbd, Label } from '../kit';
import { dx } from '../tokens';

/**
 * DxSession panel, blind session: the look's countdown (draining bar), the
 * opponent's reply in text, the result, the peek count and Peek (B / Space).
 */
export function DxBlindPanel({ view, director }: { view: BlindView; director: BlindDirector }) {
  const t = useT();
  const tn = useTn();
  const canPeek = view.stage === 'hidden';
  return (
    <View style={[styles.card, view.stage === 'preview' && styles.cardLook]} testID="dx-blind">
      <View style={styles.row}>
        <EyeOff size={13} color={dx.rose} strokeWidth={2} />
        <Label size={10}>{t('blind.title')}</Label>
        <View style={styles.flex} />
        <DText size={12} weight={700} color={dx.dust} tabular testID="dx-blind-peeks">
          {view.peeks > 0 ? plural(tn, 'blind.runner.peeks', view.peeks) : t('blind.runner.no_peeks')}
        </DText>
      </View>
      <Status view={view} t={t} />
      <GhostButton
        testID="blind-peek"
        label={t('blind.runner.peek')}
        accessibilityLabel={t('blind.runner.peek_a11y')}
        icon={Eye}
        height={40}
        disabled={!canPeek}
        onPress={() => director.peekStart(false)}
        style={[styles.peek, view.peeking && styles.peekOn]}
      >
        <View style={styles.flex} />
        <Kbd>B</Kbd>
      </GhostButton>
    </View>
  );
}

function Status({ view, t }: { view: BlindView; t: TFn }) {
  if (view.stage === 'setup' || view.stage === 'preview') return <Look view={view} t={t} />;
  if (view.stage === 'revealed') {
    const ok = view.result === 'solved';
    return (
      <View style={[styles.line, styles.mt10]} testID="blind-status">
        {ok ? <Check size={18} color={eos.sage} strokeWidth={2.4} /> : <XCircle size={18} color={dx.rose} strokeWidth={2} />}
        <DText size={18} weight={800} color={ok ? eos.sage : dx.bone} numberOfLines={1} style={styles.flex}>
          {t(ok ? 'blind.runner.solved' : 'blind.runner.missed')}
        </DText>
      </View>
    );
  }
  return (
    <View style={[styles.line, styles.mt10]} testID="blind-status" accessibilityLiveRegion="polite">
      <DText size={18} weight={800} numberOfLines={1} style={styles.flex} testID="blind-reply">
        {view.reply ? t('blind.runner.reply', { san: localSan(view.reply, t) }) : t('blind.runner.from_memory')}
      </DText>
    </View>
  );
}

function Look({ view, t }: { view: BlindView; t: TFn }) {
  const { secs, drain } = useLook(view);
  const fill = useAnimatedStyle(() => ({ width: `${drain.get() * 100}%` }));
  return (
    <View style={styles.mt10} testID="blind-status" accessible accessibilityLabel={t('blind.runner.memorize_a11y', { n: secs })}>
      <DText size={18} weight={800} tabular numberOfLines={1} testID="blind-countdown">
        {t('blind.runner.memorize', { n: secs })}
      </DText>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fill]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt10: { marginTop: 10 },
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  cardLook: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.ember, 0.6), inset: true }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 4, borderRadius: 999, backgroundColor: dx.track, overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', borderRadius: 999, backgroundColor: dx.barTo },
  peek: { marginTop: 12, paddingHorizontal: 14 },
  peekOn: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: tone.emberGlow, inset: true }] },
});

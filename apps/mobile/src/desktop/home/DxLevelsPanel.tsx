import { CALIBRATION_SESSIONS, LEVEL_STEP, isTrainingStyle, type TrainingStyle } from '@tac/core/rules';
import { levelFor } from '@tac/core/runner';
import { alpha, black, eos, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAppStore } from '@/stores/appStore';
import { PlateButton } from '@/ui';
import { useT } from '@/ui/lang';
import { CloseButton, Dialog } from '../Dialog';
import { DText, Label, Pill } from '../kit';
import { dx } from '../tokens';
import { Card2 } from './parts';

// DXLevelsInfo: "How your level works" as a full-height panel docked to the
// right of the Play page (the phone opens play/levels as a full-screen
// modal). Same copy and rules as the phone's LevelSheet.

/** Marks on the bar: two levels each side of the player's (the phone's LevelSheet). */
const MARKS = [-2, -1, 0, 1, 2] as const;

export function DxLevelsPanel({ style: pageStyle, onClose }: { style: TrainingStyle; onClose: () => void }) {
  const t = useT();
  // /play/levels?style=… (the phone's link) shows that style; opened from the page, the page's.
  const params = useLocalSearchParams<{ style?: string }>();
  const style = isTrainingStyle(params.style) ? params.style : pageStyle;
  const prog = useAppStore((s) => s.progressions[style]);
  // D39: at rest the player is at the level (every rated session starts there).
  const level = levelFor(prog);
  const lo = level + MARKS[0] * LEVEL_STEP;
  const hi = level + MARKS[MARKS.length - 1] * LEVEL_STEP;
  const ratio = (v: number) => (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo);
  const pct = (v: number) => `${ratio(v) * 100}%` as const;
  // Near an end the "you" pill hugs that edge instead of spilling out of the card.
  const edge = ratio(level) > 0.85 ? 'end' : ratio(level) < 0.15 ? 'start' : null;
  const tipBox = edge === 'end' ? styles.tipEnd : edge === 'start' ? styles.tipStart : { left: pct(level) };
  const tipSelf = { alignSelf: edge === 'end' ? 'flex-end' : edge === 'start' ? 'flex-start' : 'center' } as const;
  const ticks = MARKS.slice(1, -1).map((m) => level + m * LEVEL_STEP);
  const styleName = t(`style.${style}.name`);

  const rules: { title: string; body: string; bar: string; ink: string }[] = [
    { title: t('levels.up_title'), body: t('levels.up_body', { next: level + LEVEL_STEP }), bar: tone.sand, ink: tone.sand },
    { title: t('levels.down_title'), body: t('levels.down_body'), bar: tone.rose, ink: tone.rose },
    { title: t('levels.ranks_title'), body: t('levels.ranks_body'), bar: tone.gold, ink: tone.gold },
    { title: t('levels.casual_title'), body: t('levels.casual_body'), bar: eos.ash, ink: eos.bone },
    { title: t('levels.settling_title', { n: CALIBRATION_SESSIONS }), body: t('levels.settling_body'), bar: eos.ash, ink: eos.bone },
  ];

  return (
    <Dialog side width={480} onClose={onClose} testID="dx-levels" style={styles.panel}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Label color={tone.rose}>{t('levels.eyebrow')}</Label>
          <View style={styles.flex} />
          <CloseButton onPress={onClose} testID="dx-levels-close" />
        </View>
        <DText serif weight={700} size={26} accessibilityRole="header">
          {t('levels.title')}
        </DText>
        <DText size={14} lh={21} color={dx.ash}>
          {t('levels.intro')}
        </DText>

        <View style={styles.barCard} accessible accessibilityLabel={t('levels.bar_label', { style: styleName, level })}>
          <Label size={10}>{t('levels.bar_label', { style: styleName, level })}</Label>
          <View style={styles.track}>
            <LinearGradient colors={[dx.barOff, dx.ember]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
            {ticks.map((v) => (
              <View key={v} style={[styles.tick, { left: pct(v) }, v === level && styles.tickOwn]} />
            ))}
            <View style={[styles.thumb, { left: pct(level) }]} />
            <View style={[styles.tip, tipBox]}>
              <Pill tone="ash" label={t('play.you_marker', { rating: level })} style={[styles.tipPill, tipSelf]} />
            </View>
          </View>
          <View style={styles.ends}>
            {MARKS.map((m) => (
              <DText
                key={m}
                size={12}
                weight={m === 0 ? 800 : 400}
                color={m === 0 ? dx.bone : dx.dust}
                tabular
                testID={m === 0 ? 'dx-levels-level' : undefined}
              >
                {String(level + m * LEVEL_STEP)}
              </DText>
            ))}
          </View>
        </View>

        {rules.map((r) => (
          <Card2 key={r.title} style={[styles.rule, { boxShadow: [{ offsetX: 3, offsetY: 0, blurRadius: 0, spreadDistance: 0, color: r.bar, inset: true }] }]}>
            <DText size={14} weight={800} color={r.ink}>
              {r.title}
            </DText>
            <DText size={13} lh={19} color={dx.ash} style={styles.mt4}>
              {r.body}
            </DText>
          </Card2>
        ))}

        <PlateButton testID="dx-levels-got-it" label={t('levels.got_it')} onPress={onClose} size="lg" block style={styles.cta} />
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt4: { marginTop: 4 },
  panel: { padding: 0, backgroundColor: eos.shade, boxShadow: [{ offsetX: -30, offsetY: 0, blurRadius: 60, spreadDistance: 0, color: alpha(black, 0.5) }] },
  body: { paddingVertical: 28, paddingHorizontal: 30, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center' },
  barCard: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: dx.card,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  track: { height: 44, marginTop: 6 },
  line: { position: 'absolute', left: 0, right: 0, top: 24, height: 6, borderRadius: 3 },
  tick: { position: 'absolute', top: 21, width: 1.5, height: 12, backgroundColor: tone.iron },
  tickOwn: { width: 2, top: 19, height: 16, backgroundColor: dx.ash },
  thumb: {
    position: 'absolute',
    top: 16,
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: tone.cream,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 4, color: alpha(eos.ember, 0.5) },
      { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: 0, color: alpha(black, 0.5) },
    ],
  },
  tip: { position: 'absolute', top: -10, width: 140, marginLeft: -70, alignItems: 'center' },
  tipEnd: { right: -8, marginLeft: 0 },
  tipStart: { left: -8, marginLeft: 0 },
  tipPill: { backgroundColor: dx.ghost },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  rule: { paddingVertical: 14, paddingHorizontal: 16 },
  cta: { marginTop: 6 },
});

import { CALIBRATION_SESSIONS, LEVEL_STEP, isTrainingStyle } from '@tac/core/rules';
import { levelFor } from '@tac/core/runner';
import { alpha, control, eos, radii, semantic, space, surface, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/stores/appStore';
import { AppText, PlateButton } from '@/ui';
import { Tap } from '@/ui/Tap';
import { readLastStyle } from '../setupPrefs';
import { usePlayT } from '../strings';
import { STRONG, TABULAR } from '../ui';

// play/levels (fullScreenModal), opened from the rated card: design
// PlayV2LevelSheet "How your level works". The bar shows the player's own
// level and the marks around it (D39: the level is the only number).

/** Marks drawn on the bar: two levels each side of the player's. */
const MARKS = [-2, -1, 0, 1, 2];

export function LevelSheet() {
  const t = usePlayT();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ style?: string }>();
  const style = isTrainingStyle(params.style) ? params.style : readLastStyle();
  const prog = useAppStore((s) => s.progressions[style]);
  const level = levelFor(prog);
  const lo = level - 2 * LEVEL_STEP;
  const span = 4 * LEVEL_STEP;
  const at = (v: number) => `${(Math.min(span, Math.max(0, v - lo)) / span) * 100}%` as const;
  const close = () => router.back();

  return (
    <View style={styles.root} testID="level-sheet">
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top, paddingBottom: insets.bottom + space[10] }]}>
        <View style={styles.closeRow}>
          <Tap testID="level-sheet-close" accessibilityRole="button" accessibilityLabel={t('levels.close')} onPress={close} style={styles.close}>
            <X size={20} color={eos.ash} strokeWidth={2} />
          </Tap>
        </View>

        <View style={styles.head}>
          <AppText variant="eyebrow" color={tone.rose}>
            {t('levels.eyebrow')}
          </AppText>
          <AppText variant="heading" accessibilityRole="header">
            {t('levels.title')}
          </AppText>
          <AppText variant="body" color={eos.ash}>
            {t('levels.intro')}
          </AppText>
        </View>

        <View style={styles.barCard} accessible accessibilityLabel={`${t('levels.bar_label', { style: t(`style.${style}.name`), level })}, ${t('level.next')} ${level + LEVEL_STEP}`}>
          <AppText variant="label">{t('levels.bar_label', { style: t(`style.${style}.name`), level })}</AppText>
          <View style={styles.track}>
            <View style={styles.bar} />
            <LinearGradient colors={control.rankProgress} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: at(level) }]} />
            {MARKS.slice(1, -1).map((m) => (
              <View key={m} style={[styles.mark, { left: at(level + m * LEVEL_STEP) }, m === 0 && styles.markOwn]} />
            ))}
            <View style={[styles.you, { left: at(level) }]} />
            <View style={[styles.youLabelWrap, { left: at(level) }]}>
              <AppText variant="captionStrong" color={tone.gold} style={[styles.youLabel, TABULAR]} testID="level-sheet-rating">
                {t('play.you_marker', { rating: level })}
              </AppText>
            </View>
          </View>
          <View style={styles.marks}>
            {MARKS.map((m) => (
              <AppText
                key={m}
                variant="caption"
                color={m === 0 ? eos.bone : eos.ash}
                style={[styles.markLabel, TABULAR, m === 0 && STRONG]}
                testID={m === 0 ? 'level-sheet-level' : undefined}
              >
                {String(level + m * LEVEL_STEP)}
              </AppText>
            ))}
          </View>
        </View>

        <Rule border={alpha(tone.sage, 0.4)} bg={alpha(tone.sageDeep, 0.08)} ink={tone.sage} title={t('levels.up_title')} body={t('levels.up_body', { next: level + LEVEL_STEP })} />
        <Rule border={control.dangerBorderSoft} bg={semantic.accentWeak} ink={tone.rose} title={t('levels.down_title')} body={t('levels.down_body')} />
        <Rule border={control.goldBorder} bg={alpha(tone.gold, 0.1)} ink={tone.gold} title={t('levels.ranks_title')} body={t('levels.ranks_body')} />
        <Rule border={semantic.borderSoft} bg={surface.noteNeutral} ink={eos.bone} title={t('levels.casual_title')} body={t('levels.casual_body')} />
        <Rule
          border={semantic.borderSoft}
          bg={surface.noteNeutral}
          ink={eos.bone}
          title={t('levels.settling_title', { n: CALIBRATION_SESSIONS })}
          body={t('levels.settling_body')}
        />

        <PlateButton testID="level-sheet-got-it" label={t('levels.got_it')} onPress={close} size="lg" block style={styles.cta} />
      </ScrollView>
    </View>
  );
}

function Rule({ border, bg, ink, title, body }: { border: string; bg: string; ink: string; title: string; body: string }) {
  return (
    <View style={[styles.rule, { borderColor: border, backgroundColor: bg }]}>
      <AppText variant="body" color={ink} style={[STRONG, styles.ruleTitle]}>
        {title}
      </AppText>
      <AppText variant="caption" color={eos.ash} style={styles.body17}>
        {body}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  scroll: { paddingHorizontal: space[4], gap: space[4] },
  closeRow: { height: 44, marginHorizontal: -space[2], flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  head: { gap: space[1.5] },
  barCard: { padding: space[4], borderRadius: radii.xl, backgroundColor: eos.slate, gap: space[2.5] },
  track: { height: 34, justifyContent: 'flex-end', paddingBottom: 6 },
  bar: { height: 6, borderRadius: radii.full, backgroundColor: eos.well },
  fill: { position: 'absolute', left: 0, bottom: 6, height: 6, borderRadius: radii.full },
  mark: { position: 'absolute', bottom: 2, width: 2, height: 14, marginLeft: -1, backgroundColor: eos.seam },
  markOwn: { backgroundColor: eos.dust },
  you: { position: 'absolute', bottom: 2, width: 2, height: 14, marginLeft: -1, backgroundColor: tone.gold },
  youLabelWrap: { position: 'absolute', top: 0, width: 120, marginLeft: -60, alignItems: 'center' },
  youLabel: { fontSize: 10, lineHeight: 12, letterSpacing: 0.6 },
  marks: { flexDirection: 'row', justifyContent: 'space-between' },
  markLabel: { fontSize: 11, lineHeight: 15 },
  rule: { padding: space[4], borderRadius: radii.xl, borderWidth: 1, gap: space[1.5] },
  ruleTitle: { lineHeight: 19 },
  body17: { lineHeight: 17 },
  cta: { marginTop: space[2] },
});

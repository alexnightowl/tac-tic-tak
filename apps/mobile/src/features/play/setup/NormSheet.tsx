import { CALIBRATION_SESSIONS, DEMOTE_PENALTY, UNLOCK_REWARD, isTrainingStyle, peakFloor } from '@tac/core/rules';
import { alpha, black, control, eos, radii, semantic, space, tone } from '@tac/core/tokens';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/stores/appStore';
import { AppText, PlateButton } from '@/ui';
import { Tap } from '@/ui/Tap';
import { readLastStyle, ratingCap } from '../setupPrefs';
import { usePlayT } from '../strings';
import { STRONG } from '../ui';

// play/norm (fullScreenModal), the "?" next to the setup's rating label:
// design Artboard-7puf "Play — how the norm works". The numbers are the
// player's own for the style the setup shows (norm, floor = norm − 50,
// cap = norm + 200); the bar itself is a fixed illustration.

/** The illustration's zone split (comfort | level-up | locked), as drawn. */
const BAR_LEVELUP_FROM = '55%';
const BAR_LEVELUP_W = '25%';
const BAR_LOCK_FROM = '80%';

export function NormSheet() {
  const t = usePlayT();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ style?: string }>();
  const style = isTrainingStyle(params.style) ? params.style : readLastStyle();
  const prog = useAppStore((s) => s.progressions[style]);
  const norm = prog.unlockedStartRating;
  const floor = peakFloor(norm);
  const cap = ratingCap(prog);
  const close = () => router.back();

  return (
    <View style={styles.root} testID="norm-sheet">
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top, paddingBottom: insets.bottom + space[10] }]}>
        <View style={styles.closeRow}>
          <Tap
            testID="norm-close"
            accessibilityRole="button"
            accessibilityLabel={t('play.close')}
            onPress={close}
            style={styles.close}
          >
            <X size={20} color={eos.ash} strokeWidth={2} />
          </Tap>
        </View>

        <View style={styles.head}>
          <AppText variant="eyebrow" color={tone.rose}>
            {t('play.norm.kicker')}
          </AppText>
          <AppText variant="heading" accessibilityRole="header">
            {t('play.norm.title')}
          </AppText>
          <AppText variant="body" color={eos.ash}>
            {t('play.norm.lede')}
          </AppText>
        </View>

        <View style={styles.barCard}>
          <AppText variant="label">{t('play.norm.bar_label')}</AppText>
          <View style={styles.bar}>
            <View style={[styles.barPart, styles.barComfort]} />
            <View style={[styles.barPart, styles.barLevelUp]} />
            <View style={styles.barLock} />
          </View>
          <View style={styles.barLabels}>
            <AppText variant="caption" color={eos.ash} style={styles.barLabel}>
              {'400'}
            </AppText>
            <AppText variant="caption" color={tone.gold} style={styles.barLabel} testID="norm-norm">
              {t('play.norm.bar_norm', { norm })}
            </AppText>
            <AppText variant="caption" color={eos.ash} style={styles.barLabel} testID="norm-cap">
              {t('play.norm.bar_cap', { cap })}
            </AppText>
          </View>
        </View>

        <View style={styles.legend}>
          <Legend swatch={<View style={[styles.swatch, { backgroundColor: eos.dust }]} />} title={t('play.norm.comfort_title')} body={t('play.norm.comfort_body')} />
          <Legend
            swatch={<View style={[styles.swatch, { backgroundColor: eos.ember }]} />}
            title={t('play.norm.levelup_title')}
            body={t('play.norm.levelup_body', { floor })}
          />
          <Legend swatch={<View style={styles.lockDisc} />} title={t('play.norm.lock_title')} body={t('play.norm.lock_body', { span: cap - norm })} />
        </View>

        <Rule
          border={alpha(tone.sage, 0.4)}
          bg={alpha(tone.sageDeep, 0.08)}
          ink={tone.sage}
          title={t('play.norm.up_title', { reward: UNLOCK_REWARD })}
          body={t('play.norm.up_body', { floor })}
        />
        <Rule
          border={control.dangerBorderSoft}
          bg={semantic.accentWeak}
          ink={tone.rose}
          title={t('play.norm.down_title', { penalty: DEMOTE_PENALTY })}
          body={t('play.norm.down_body')}
        />
        <Rule
          border={control.goldBorder}
          bg={alpha(tone.gold, 0.1)}
          ink={tone.gold}
          title={t('play.norm.cal_title', { n: CALIBRATION_SESSIONS })}
          body={t('play.norm.cal_body')}
        />

        <PlateButton testID="norm-got-it" label={t('play.norm.got_it')} onPress={close} size="lg" block style={styles.cta} />
      </ScrollView>
    </View>
  );
}

function Legend({ swatch, title, body }: { swatch: ReactNode; title: string; body: string }) {
  return (
    <View style={styles.legendRow}>
      {swatch}
      <View style={styles.flex}>
        <AppText variant="body" color={eos.bone} style={[STRONG, styles.legendTitle]}>
          {title}
        </AppText>
        <AppText variant="caption" color={eos.ash} style={styles.body17}>
          {body}
        </AppText>
      </View>
    </View>
  );
}

function Rule({ border, bg, ink, title, body }: { border: string; bg: string; ink: string; title: string; body: string }) {
  return (
    <View style={[styles.rule, { borderColor: border, backgroundColor: bg }]}>
      <AppText variant="body" color={ink} style={[STRONG, styles.legendTitle]}>
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
  barCard: { padding: space[4], borderRadius: radii.xl, backgroundColor: eos.slate, gap: space[3] },
  bar: { height: 6, borderRadius: radii.full, backgroundColor: eos.well },
  barPart: { position: 'absolute', top: 0, height: 6, borderRadius: radii.full },
  barComfort: { left: 0, width: BAR_LEVELUP_FROM, backgroundColor: eos.dust },
  barLevelUp: { left: BAR_LEVELUP_FROM, width: BAR_LEVELUP_W, backgroundColor: eos.ember },
  barLock: {
    position: 'absolute',
    left: BAR_LOCK_FROM,
    right: 0,
    top: -1,
    height: 8,
    borderTopRightRadius: radii.full,
    borderBottomRightRadius: radii.full,
    backgroundColor: alpha(black, 0.8),
  },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 11, lineHeight: 15 },
  legend: { gap: 14 },
  legendRow: { flexDirection: 'row', gap: space[3] },
  swatch: { width: 16, height: 6, marginTop: 7, borderRadius: radii.full },
  lockDisc: { width: 16, height: 16, borderRadius: radii.full, backgroundColor: eos.well, borderWidth: 1, borderColor: eos.seam },
  flex: { flex: 1, minWidth: 0 },
  legendTitle: { lineHeight: 19 },
  body17: { lineHeight: 17 },
  rule: { padding: space[4], borderRadius: radii.xl, borderWidth: 1, gap: space[1.5] },
  cta: { marginTop: space[2] },
});

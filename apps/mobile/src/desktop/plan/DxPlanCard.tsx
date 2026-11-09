import { themeLabel } from '@tac/core/themes';
import type { TrainingStyle } from '@tac/core/rules';
import { alpha, eos } from '@tac/core/tokens';
import { CalendarCheck, Check, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { planThemeText, usePlan } from '@/features/plan/PlanCard';
import { ThemeIcon } from '@/features/play/themes/ThemeIcon';
import { PlateButton } from '@/ui';
import { useLang, useT } from '@/ui/lang';
import { Card, DText, GhostButton, Label } from '../kit';
import { dx } from '../tokens';

/**
 * Home on a desktop window: "Today's plan" (D40), under the hero. The
 * three weakest themes as chips with their accuracy, the length and the
 * start difficulty, Start plan; once done today, the result and Again.
 * The phone PlanCard's data (usePlan). Hidden while loading / on error.
 */
export function DxPlanCard({ style }: { style: TrainingStyle }) {
  const t = useT();
  const { lang } = useLang();
  const { plan, starting, start } = usePlan(style);
  const [w, setW] = useState(0);
  if (!plan || plan.themes.length === 0) return null;
  const narrow = w > 0 && w < 720;
  const done = plan.done && plan.session;
  const minutes = Math.round(plan.durationSec / 60);
  const themesText = plan.themes.map((th) => themeLabel(th.slug, lang)).join(', ');
  const s = plan.session;

  const cta = done ? (
    <GhostButton
      testID="dx-home-plan-again"
      label={t('plan.again')}
      accessibilityLabel={t('plan.again_a11y')}
      icon={RotateCcw}
      height={44}
      disabled={starting}
      onPress={() => void start(plan)}
      style={narrow ? styles.ctaNarrow : styles.cta}
    />
  ) : (
    <PlateButton
      testID="dx-home-plan-start"
      label={t('plan.start')}
      accessibilityLabel={t('plan.start_a11y', { themes: themesText })}
      size="md"
      loading={starting}
      block={narrow}
      onPress={() => void start(plan)}
      style={narrow ? undefined : styles.cta}
    />
  );

  return (
    <Card style={[styles.card, done && styles.cardDone]} testID="dx-home-plan">
      <View style={StyleSheet.absoluteFill} onLayout={(e) => setW(e.nativeEvent.layout.width)} pointerEvents="none" />
      <View style={styles.row}>
        <View style={[styles.icon, done && styles.iconDone]}>
          {done ? <Check size={20} color={eos.sage} strokeWidth={2.4} /> : <CalendarCheck size={20} color={dx.rose} strokeWidth={1.8} />}
        </View>
        <View style={styles.flex}>
          <View style={styles.head}>
            <Label color={done ? dx.sage : dx.rose}>{done ? t('plan.done_title') : t('plan.title')}</Label>
            <DText size={12.5} color={dx.dust} tabular testID="dx-home-plan-meta">
              {t('plan.meta', { min: minutes, rating: plan.startRating })}
            </DText>
          </View>
          {done && s ? (
            <DText size={16} weight={800} tabular style={styles.mt4} testID="dx-home-plan-result">
              {t('plan.done_result', { solved: s.solved, total: s.solved + s.failed, pct: Math.round(s.accuracy * 100) })}
            </DText>
          ) : (
            <DText size={13} color={dx.ash} style={styles.mt4}>
              {t('plan.sub')}
            </DText>
          )}
          <View style={styles.chips}>
            {plan.themes.map((th) => (
              <View key={th.slug} style={styles.chip} testID={`dx-home-plan-theme-${th.slug}`}>
                <ThemeIcon slug={th.slug} size={14} color={th.reason === 'new' ? dx.ash : dx.rose} />
                <DText size={12.5} weight={700} color={done ? dx.ash : dx.bone} tabular numberOfLines={1}>
                  {planThemeText(th, lang, t)}
                </DText>
              </View>
            ))}
          </View>
        </View>
        {narrow ? null : <View style={styles.ctaWrap}>{cta}</View>}
      </View>
      {narrow ? <View style={styles.mt14}>{cta}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 20, paddingHorizontal: 22 },
  cardDone: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.sage, 0.35), inset: true }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  icon: { width: 48, height: 48, borderRadius: 12, backgroundColor: dx.ghost, alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: alpha(eos.sage, 0.16) },
  mt4: { marginTop: 4 },
  mt14: { marginTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  ctaWrap: { alignSelf: 'stretch', justifyContent: 'center' },
  cta: { minWidth: 180 },
  ctaNarrow: { alignSelf: 'stretch' },
});

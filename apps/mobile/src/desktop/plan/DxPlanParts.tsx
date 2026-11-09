import { hasteMs, type TrainingStyle } from '@tac/core/rules';
import { themeLabel } from '@tac/core/themes';
import { alpha, eos, tone } from '@tac/core/tokens';
import { CalendarCheck, Gauge } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { fmtSecs, hasteTipKey } from '@/features/haste/model';
import type { PlanRecord } from '@/features/plan/model';
import { usePlanDone } from '@/features/plan/PlanSummaryCard';
import { ThemeIcon } from '@/features/play/themes/ThemeIcon';
import { useLang, useT } from '@/ui/lang';
import { Bar, DText, Label } from '../kit';
import { dx } from '../tokens';

// Desktop pieces of the D40 daily plan and haste indicator for the runner
// (DxSession) and its summary (DxSessionSummary).

const inset = (c: string) => [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: c, inset: true }] as const;

/** Runner panel: the session label of a plan session ("Today's plan" and its themes). */
export function DxPlanRunnerCard({ plan }: { plan: PlanRecord }) {
  const t = useT();
  const { lang } = useLang();
  return (
    <View style={styles.runner} testID="runner-plan">
      <View style={styles.row}>
        <CalendarCheck size={13} color={dx.rose} strokeWidth={2} />
        <Label size={10} color={dx.rose}>
          {t('plan.title')}
        </Label>
      </View>
      <View style={styles.chips}>
        {plan.themes.map((slug) => (
          <View key={slug} style={styles.chip}>
            <ThemeIcon slug={slug} size={12} color={dx.ash} />
            <DText size={12} weight={700} color={dx.ash} numberOfLines={1}>
              {themeLabel(slug, lang)}
            </DText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Runner panel: the one-time haste nudge as a gold panel card (~3 s). */
export function DxHasteNudgeCard({ mistakeMs }: { mistakeMs: number }) {
  const t = useT();
  const { lang } = useLang();
  const text = t('haste.nudge', { secs: fmtSecs(mistakeMs, lang, t) });
  return (
    <View style={styles.nudge} testID="haste-nudge" accessible accessibilityRole="alert" accessibilityLabel={`${text}. ${t('haste.nudge_hint')}`}>
      <Gauge size={16} color={tone.gold} strokeWidth={2} />
      <View style={styles.flex}>
        <DText size={14} weight={800} numberOfLines={1}>
          {text}
        </DText>
        <DText size={12.5} color={dx.ash} numberOfLines={1}>
          {t('haste.nudge_hint')}
        </DText>
      </View>
    </View>
  );
}

/** Summary: "Hasty mistakes: 3 of 5", the style's threshold, one tip. */
export function DxHasteSummary({ hasty, mistakes, style }: { hasty: number; mistakes: number; style: TrainingStyle }) {
  const t = useT();
  const { lang } = useLang();
  if (mistakes <= 0) return null;
  const lots = hasty > 0 && hasty * 2 >= mistakes;
  return (
    <View style={[styles.panel, lots && styles.panelGold]} testID="summary-haste">
      <View style={[styles.disc, lots && styles.discGold]}>
        <Gauge size={16} color={lots ? tone.gold : dx.ash} strokeWidth={1.8} />
      </View>
      <View style={styles.flex}>
        <DText size={14} weight={800} color={lots ? tone.gold : dx.bone} tabular testID="summary-haste-title">
          {t('haste.summary_title', { hasty, total: mistakes })}
        </DText>
        <DText size={12.5} color={dx.ash} style={styles.mt2}>
          {t('haste.summary_rule', { secs: fmtSecs(hasteMs(style), lang, t), style: t(`style.${style}.name`).toLowerCase() })}
        </DText>
        <DText size={13} color={dx.bone} style={styles.mt6} testID="summary-haste-tip">
          {t(hasteTipKey(hasty, mistakes))}
        </DText>
      </View>
    </View>
  );
}

/** Summary of a plan session: done (or not, by the server) and each theme's result. */
export function DxPlanSummary({ plan }: { plan: PlanRecord }) {
  const t = useT();
  const { lang } = useLang();
  const done = usePlanDone(plan);
  return (
    <View style={[styles.panel, styles.col, done && styles.panelSage]} testID="summary-plan">
      <View style={styles.rowTop}>
        <View style={[styles.disc, done && styles.discSage]}>
          <CalendarCheck size={16} color={done ? eos.sage : dx.ash} strokeWidth={1.8} />
        </View>
        <View style={styles.flex}>
          <DText size={14} weight={800} color={done ? eos.sage : dx.bone} testID={done ? 'summary-plan-done' : 'summary-plan-title'}>
            {done == null ? t('plan.title') : done ? t('plan.summary_done') : t('plan.summary_early')}
          </DText>
          {done != null ? (
            <DText size={12.5} color={dx.ash} style={styles.mt2}>
              {done ? t('plan.summary_hint') : t('plan.summary_early_hint')}
            </DText>
          ) : null}
        </View>
      </View>
      <View style={styles.themes}>
        {plan.themes.map((slug) => {
          const r = plan.results[slug];
          return (
            <View key={slug} style={styles.themeRow} testID={`summary-plan-theme-${slug}`}>
              <ThemeIcon slug={slug} size={14} color={dx.ash} />
              <DText size={13} weight={700} numberOfLines={1} style={styles.themeName}>
                {themeLabel(slug, lang)}
              </DText>
              <Bar value={r && r.total ? r.solved / r.total : 0} colors={[dx.accHigh, eos.sage]} style={styles.flex} />
              <DText size={13} weight={800} tabular align="right" color={r && r.total ? dx.bone : dx.dust} style={styles.themeVal}>
                {r && r.total ? t('plan.theme_result', { solved: r.solved, total: r.total }) : t('plan.theme_none')}
              </DText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  col: { flexDirection: 'column', alignItems: 'stretch' },
  mt2: { marginTop: 2 },
  mt6: { marginTop: 6 },
  runner: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: dx.card2, boxShadow: [...inset(alpha(eos.bone, 0.05))] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: dx.track },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: alpha(tone.gold, 0.1),
    boxShadow: [...inset(alpha(tone.gold, 0.45))],
  },
  panel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [...inset(alpha(eos.bone, 0.05))],
  },
  panelGold: { backgroundColor: alpha(tone.gold, 0.08), boxShadow: [...inset(alpha(tone.gold, 0.35))] },
  panelSage: { backgroundColor: alpha(eos.sage, 0.08), boxShadow: [...inset(alpha(eos.sage, 0.35))] },
  disc: { width: 32, height: 32, borderRadius: 9, backgroundColor: dx.ghost, alignItems: 'center', justifyContent: 'center' },
  discGold: { backgroundColor: alpha(tone.gold, 0.16) },
  discSage: { backgroundColor: alpha(eos.sage, 0.16) },
  themes: { marginTop: 10, gap: 10 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 46 },
  themeName: { width: 150 },
  themeVal: { width: 70 },
});

import { themeLabel } from '@tac/core/themes';
import { eos, space } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemeIcon } from '@/features/play/themes/ThemeIcon';
import { NoteCard, ProgressBar, STRONG, TABULAR } from '@/features/play/ui';
import { AppText } from '@/ui';
import { useLang, useT } from '@/ui/lang';
import { localMidnightISO, planQuery, type PlanRecord } from './model';

/**
 * Did this session complete today's plan? The server's word (GET
 * /plan/today, refetched when the session ends): null while it loads.
 */
export function usePlanDone(plan: PlanRecord): boolean | null {
  const q = useQuery(planQuery(plan.style, localMidnightISO()));
  // A cached plan from before the finish is being refetched: wait for it.
  if (!q.data || q.isFetching) return q.isError ? false : null;
  return q.data.done && q.data.session?.id === plan.sessionId;
}

/** Session summary of a daily plan (D40, phone): "Plan done" and each plan theme's result. */
export function PlanSummaryCard({ plan }: { plan: PlanRecord }) {
  const t = useT();
  const { lang } = useLang();
  const done = usePlanDone(plan);
  const ink = done ? eos.sage : eos.bone;
  return (
    <NoteCard tone={done ? 'sage' : 'neutral'} style={styles.card} testID="summary-plan">
      <View style={styles.head}>
        <CalendarCheck size={20} color={done ? eos.sage : eos.ash} />
        <View style={styles.flex}>
          <AppText variant="body" color={ink} style={STRONG} testID={done ? 'summary-plan-done' : 'summary-plan-title'}>
            {done == null ? t('plan.title') : done ? t('plan.summary_done') : t('plan.summary_early')}
          </AppText>
          {done != null ? (
            <AppText variant="caption" color={eos.ash}>
              {done ? t('plan.summary_hint') : t('plan.summary_early_hint')}
            </AppText>
          ) : null}
        </View>
      </View>
      {plan.themes.map((slug) => {
        const r = plan.results[slug];
        return (
          <View key={slug} style={styles.row} testID={`summary-plan-theme-${slug}`}>
            <ThemeIcon slug={slug} size={16} color={eos.ash} />
            <AppText variant="caption" color={eos.bone} numberOfLines={1} style={styles.name}>
              {themeLabel(slug, lang)}
            </AppText>
            <View style={styles.bar}>
              <ProgressBar ratio={r && r.total ? r.solved / r.total : 0} color={eos.sage} />
            </View>
            <AppText variant="caption" color={eos.ash} style={[styles.val, TABULAR]}>
              {r && r.total ? t('plan.theme_result', { solved: r.solved, total: r.total }) : t('plan.theme_none')}
            </AppText>
          </View>
        );
      })}
    </NoteCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[2.5] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  name: { flex: 1.4, minWidth: 0 },
  bar: { flex: 1 },
  val: { minWidth: 56, textAlign: 'right' },
});

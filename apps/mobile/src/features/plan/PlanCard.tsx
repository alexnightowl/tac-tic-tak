import type { PlanTheme, PlanToday } from '@tac/core/api';
import type { Language } from '@tac/core/i18n';
import type { TrainingStyle } from '@tac/core/rules';
import { themeLabel } from '@tac/core/themes';
import { alpha, eos, radii, semantic, space } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { CalendarCheck, Check } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { startErrorKey } from '@/features/play/strings';
import { ThemeIcon } from '@/features/play/themes/ThemeIcon';
import { STRONG, TABULAR } from '@/features/play/ui';
import { toast } from '@/shell/toast/store';
import { AppText, Card, PlateButton } from '@/ui';
import { useLang, useT, type TFn } from '@/ui/lang';
import { localMidnightISO, planQuery, startPlanSession } from './model';

/** "Fork · 48%" or "Pin · new theme". */
export function planThemeText(th: PlanTheme, lang: Language, t: TFn): string {
  const name = themeLabel(th.slug, lang);
  return th.reason === 'new' || th.accuracy == null ? `${name} · ${t('plan.theme_new')}` : `${name} · ${Math.round(th.accuracy * 100)}%`;
}

/** Today's plan for the Play setup's style; start state, starting flag, done state. */
export function usePlan(style: TrainingStyle) {
  const t = useT();
  const since = localMidnightISO();
  const q = useQuery(planQuery(style, since));
  const [starting, setStarting] = useState(false);
  const start = async (plan: PlanToday) => {
    if (starting) return;
    setStarting(true);
    try {
      const id = await startPlanSession({
        style: plan.style,
        themes: plan.themes.map((x) => x.slug),
        durationSec: plan.durationSec,
        startRating: plan.startRating,
      });
      router.push(`/play/${id}` as Href);
    } catch (e) {
      toast.show({ title: t(startErrorKey(e)) });
    } finally {
      setStarting(false);
    }
  };
  return { plan: q.data ?? null, starting, start };
}

/**
 * Home (phone): "Today's plan" (D40). The three weakest themes with their
 * accuracy, length and difficulty, and Start; once a plan session finished
 * today, "Plan done" with its result and "Again". Hidden while loading or
 * when the plan can't be fetched (Home stays as it was).
 */
export function PlanCard({ style }: { style: TrainingStyle }) {
  const t = useT();
  const { lang } = useLang();
  const { plan, starting, start } = usePlan(style);
  if (!plan || plan.themes.length === 0) return null;
  const done = plan.done && plan.session;
  const minutes = Math.round(plan.durationSec / 60);
  const themesText = plan.themes.map((th) => themeLabel(th.slug, lang)).join(', ');
  return (
    <Card style={[styles.card, done && styles.cardDone]} testID="home-plan">
      <View style={styles.head}>
        {done ? (
          <View style={styles.doneDisc}>
            <Check size={14} color={eos.ink} strokeWidth={3} />
          </View>
        ) : (
          <CalendarCheck size={16} color={eos.rose} />
        )}
        <AppText variant="label" color={done ? eos.sage : eos.rose}>
          {done ? t('plan.done_title') : t('plan.title')}
        </AppText>
        <View style={styles.flex} />
        <AppText variant="caption" color={eos.dust} style={TABULAR} testID="home-plan-meta">
          {t('plan.meta', { min: minutes, rating: plan.startRating })}
        </AppText>
      </View>

      {done && plan.session ? (
        <AppText variant="body" color={eos.bone} style={[STRONG, TABULAR]} testID="home-plan-result">
          {t('plan.done_result', {
            solved: plan.session.solved,
            total: plan.session.solved + plan.session.failed,
            pct: Math.round(plan.session.accuracy * 100),
          })}
        </AppText>
      ) : (
        <AppText variant="caption" color={eos.ash}>
          {t('plan.sub')}
        </AppText>
      )}

      <View style={styles.chips}>
        {plan.themes.map((th) => (
          <View key={th.slug} style={styles.chip} testID={`home-plan-theme-${th.slug}`}>
            <ThemeIcon slug={th.slug} size={14} color={th.reason === 'new' ? eos.ash : eos.rose} />
            <AppText variant="caption" color={eos.bone} numberOfLines={1} style={TABULAR}>
              {planThemeText(th, lang, t)}
            </AppText>
          </View>
        ))}
      </View>

      {done ? (
        <PlateButton
          testID="home-plan-again"
          label={t('plan.again')}
          accessibilityLabel={t('plan.again_a11y')}
          variant="slate"
          size="md"
          block
          loading={starting}
          onPress={() => void start(plan)}
        />
      ) : (
        <PlateButton
          testID="home-plan-start"
          label={t('plan.start')}
          accessibilityLabel={t('plan.start_a11y', { themes: themesText })}
          size="md"
          block
          loading={starting}
          onPress={() => void start(plan)}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[3] },
  cardDone: { borderColor: alpha(eos.sage, 0.35) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1 },
  doneDisc: { width: 20, height: 20, borderRadius: 10, backgroundColor: eos.sage, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    paddingHorizontal: space[2.5],
    paddingVertical: space[1.5],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
    backgroundColor: eos.well,
    maxWidth: '100%',
  },
});

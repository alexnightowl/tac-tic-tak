import { localeFor, streakState } from '@tac/core/format';
import { eos, layout, radii, rank, semantic, space } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Flame, Snowflake, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { TABULAR } from '@/features/play/ui';
import { useAppStore } from '@/stores/appStore';
import { AppText, useLang, useT } from '@/ui';
import { Tap } from '@/ui/Tap';

/**
 * /streak formSheet (mobile-only; the web had just the badge): the count,
 * what today means for it, the freeze, and the rules in one breath.
 */
export function StreakSheet() {
  const t = useT();
  const { lang } = useLang();
  const streak = useAppStore((s) => s.streak);
  const st = streakState(streak.days, streak.lastDay);
  const days = st === 'broken' || st === 'none' ? 0 : streak.days;
  const stateText = t(`streak.state_${st}`);
  const regen = streak.freezeRegenAt
    ? new Date(`${streak.freezeRegenAt}T12:00:00`).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'long' })
    : null;
  const freezeText = streak.freezes > 0 ? t('streak.freeze_ready') : regen ? t('streak.freeze_used', { date: regen }) : null;
  const lit = st === 'secured' || st === 'at_risk';

  return (
    <View style={styles.root} testID="screen-streak">
      <View style={styles.close}>
        <Tap testID="screen-streak-close" accessibilityRole="button" accessibilityLabel={t('play.close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))} style={styles.closeBtn}>
          <X size={22} color={eos.bone} />
        </Tap>
      </View>
      <AppText variant="label" style={styles.center} accessibilityRole="header" testID="screen-streak-title">
        {t('streak.title')}
      </AppText>
      <View style={styles.hero} accessible accessibilityLabel={`${t('streak.title')}: ${days}`}>
        <Flame size={40} color={lit ? rank.intermediate.color : eos.dust} />
        <AppText variant="display" color={lit ? eos.bone : eos.ash} style={TABULAR} testID="streak-days">
          {String(days)}
        </AppText>
      </View>
      <AppText variant="body" color={eos.bone} style={styles.center} testID={`streak-state-${st}`}>
        {stateText}
      </AppText>
      {freezeText && (
        <View style={styles.freeze} testID="streak-freeze">
          <Snowflake size={16} color={eos.sage} />
          <AppText variant="caption" color={eos.ash} style={styles.flex}>
            {freezeText}
          </AppText>
        </View>
      )}
      <AppText variant="caption" color={eos.dust} style={styles.center}>
        {t('streak.rules')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  // No flex: a fitToContents sheet measures this view.
  root: { padding: layout.gutter, paddingTop: space[8], paddingBottom: space[10], gap: space[4], backgroundColor: eos.shade },
  close: { position: 'absolute', top: space[2], right: space[2], zIndex: 1 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[3] },
  freeze: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
    backgroundColor: eos.well,
  },
});

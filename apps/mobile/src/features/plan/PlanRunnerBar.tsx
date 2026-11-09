import { themeLabel } from '@tac/core/themes';
import { eos, radii, semantic, space } from '@tac/core/tokens';
import { CalendarCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui';
import { useLang, useT } from '@/ui/lang';
import type { PlanRecord } from './model';

/** The runner's session label for a daily plan (D40, phone): "Today's plan · Fork, Pin, Skewer". */
export function PlanRunnerBar({ plan }: { plan: PlanRecord }) {
  const t = useT();
  const { lang } = useLang();
  const themes = plan.themes.map((s) => themeLabel(s, lang)).join(' · ');
  return (
    <View style={styles.bar} testID="runner-plan" accessible accessibilityLabel={`${t('plan.title')}: ${themes}`}>
      <CalendarCheck size={16} color={eos.rose} />
      <View style={styles.flex}>
        <AppText variant="label" color={eos.rose}>
          {t('plan.title')}
        </AppText>
        <AppText variant="caption" color={eos.ash} numberOfLines={2}>
          {themes}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
    backgroundColor: eos.well,
  },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});

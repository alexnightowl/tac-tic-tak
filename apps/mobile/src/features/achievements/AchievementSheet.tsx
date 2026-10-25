import { achievementCategoryKey, achievementDescKey, achievementMeta, achievementNameKey } from '@tac/core/catalogs';
import { eos, graphite, layout, rank, space } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/ui/AppText';
import { useLang, useT } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { achievementsQuery } from './api';
import { AchievementChip, formatUnlockDate } from './AchievementsGrid';
import './icons';

/**
 * Achievement detail (formSheet `achievement/[slug]`, new on mobile): big
 * chip, name, criterion, and the unlock date or what is left to do. Reads
 * the grid's cached list; a deep link without it fetches.
 */
export function AchievementSheet({ slug }: { slug: string }) {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const list = useQuery(achievementsQuery());
  const a = list.data?.find((x) => x.slug === slug);
  const meta = achievementMeta(slug);
  const unlocked = !!a?.unlocked;

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, space[6]) }]} testID="screen-achievement">
      <View style={styles.close}>
        <Tap
          testID="screen-achievement-close"
          accessibilityRole="button"
          accessibilityLabel={t('achv.close')}
          onPress={() => router.back()}
          style={styles.closeBtn}
        >
          <X size={22} color={eos.bone} />
        </Tap>
      </View>
      <AchievementChip slug={slug} unlocked={unlocked} size={88} />
      {meta ? (
        <AppText variant="label" color={eos.dust}>
          {t(achievementCategoryKey(meta.category))}
        </AppText>
      ) : null}
      <AppText variant="title" style={styles.center} accessibilityRole="header" testID="achievement-name">
        {t(achievementNameKey(slug))}
      </AppText>
      <AppText variant="body" color={graphite[300]} style={styles.center}>
        {t(achievementDescKey(slug))}
      </AppText>
      <AppText
        variant="label"
        color={unlocked ? rank.intermediate.color : eos.dust}
        style={styles.state}
        testID="achievement-state"
      >
        {unlocked
          ? t('achv.unlocked_on', { date: a?.unlockedAt ? formatUnlockDate(a.unlockedAt, lang) : '' })
          : t('achv.locked')}
      </AppText>
      {!unlocked ? (
        <AppText variant="caption" color={eos.dust} style={styles.center}>
          {t('achv.locked_hint')}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // No flex: the fitToContents sheet measures this view.
  root: {
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: layout.gutter + space[2],
    paddingTop: space[10],
    backgroundColor: eos.shade,
  },
  close: { position: 'absolute', top: space[2], right: space[2], zIndex: 1 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  state: { marginTop: space[2] },
});

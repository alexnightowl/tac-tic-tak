import { achievementCategoryKey, achievementDescKey, achievementMeta, achievementNameKey } from '@tac/core/catalogs';
import { alpha, eos } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Share as ShareIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { achievementsQuery } from '@/features/achievements/api';
import { medalArt, TIER_CHIP } from '@/features/achievements/art';
import { formatUnlockDate } from '@/features/achievements/AchievementsGrid';
import { shareAchievement } from '@/features/achievements/AchievementSheet';
import '@/features/achievements/icons';
import { Medal } from '@/features/achievements/Medal';
import { useAuthStore } from '@/stores/authStore';
import { PlateButton } from '@/ui';
import { useLang, useT } from '@/ui/lang';
import { CloseButton, Dialog } from '../Dialog';
import { DText, GhostButton, Label } from '../kit';
import { dx } from '../tokens';

/**
 * /achievement/[slug] on a desktop window (DXAchievementModal): a 440 px
 * dialog over the page beneath — the 120 medal, tier · category pill, name,
 * criterion, the "received / category" box, Share (unlocked) and Close.
 */
export function DxAchievementModal({ slug }: { slug: string }) {
  const t = useT();
  const { lang } = useLang();
  const me = useAuthStore((s) => s.user);
  const list = useQuery(achievementsQuery());
  const a = list.data?.find((x) => x.slug === slug);
  const meta = achievementMeta(slug);
  const unlocked = !!a?.unlocked;
  const { tier } = medalArt(slug);
  const chip = TIER_CHIP[tier];
  const name = t(achievementNameKey(slug));
  const category = meta ? t(achievementCategoryKey(meta.category)) : null;
  const inCategory = meta ? (list.data ?? []).filter((x) => x.category === meta.category) : [];
  const close = () => (router.canGoBack() ? router.back() : router.replace('/stats' as Href));

  return (
    <Dialog onClose={close} width={440} testID="screen-achievement" style={styles.card}>
      <View style={styles.close}>
        <CloseButton onPress={close} testID="achievement-close" />
      </View>
      <Medal slug={slug} unlocked={unlocked} disc={120} lockBadge />
      <View style={[styles.pill, { backgroundColor: chip.bg }]} testID="achievement-tier">
        <DText size={11.5} weight={800} ls={1} upper color={chip.fg}>
          {category ? `${t(`achv.tier.${tier}`)} · ${category}` : t(`achv.tier.${tier}`)}
        </DText>
      </View>
      <DText serif weight={700} size={28} align="center" style={styles.title} accessibilityRole="header" testID="achievement-name">
        {name}
      </DText>
      <DText size={14} color={dx.ash} align="center" style={styles.desc}>
        {t(achievementDescKey(slug))}
      </DText>
      <View style={styles.box}>
        <View style={styles.cell}>
          <Label size={9.5}>{unlocked ? t('dx.rivals.achv_received') : t('dx.rivals.achv_status')}</Label>
          <DText size={14} weight={800} style={styles.mt4} testID="achievement-state" align="center">
            {unlocked ? (a?.unlockedAt ? formatUnlockDate(a.unlockedAt, lang) : '—') : t('achv.locked_hint')}
          </DText>
        </View>
        {category ? (
          <View style={styles.cell}>
            <Label size={9.5}>{category}</Label>
            <DText size={14} weight={800} tabular style={styles.mt4} align="center">
              {t('dx.rivals.achv_in_category', { done: inCategory.filter((x) => x.unlocked).length, total: inCategory.length })}
            </DText>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        {unlocked ? (
          <PlateButton
            label={t('achv.share')}
            testID="achievement-share"
            variant="ember"
            size="sm"
            icon={<ShareIcon size={15} color={eos.bone} strokeWidth={2} />}
            onPress={() => shareAchievement(t('achv.share_message', { name }), me?.nickname)}
            style={styles.flex}
          />
        ) : null}
        <GhostButton label={t('achv.close')} testID="achievement-close-btn" accessibilityLabel={t('achv.close')} onPress={close} style={styles.flex} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt4: { marginTop: 4 },
  card: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: dx.modal,
    boxShadow: [
      { offsetX: 0, offsetY: 30, blurRadius: 80, spreadDistance: 0, color: dx.popShadow },
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.modalEdge, inset: true },
    ],
  },
  close: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  pill: { marginTop: 20, height: 24, paddingHorizontal: 9, borderRadius: 999, justifyContent: 'center' },
  title: { marginTop: 10 },
  desc: { marginTop: 6 },
  box: {
    marginTop: 20,
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  cell: { flex: 1, alignItems: 'center' },
  actions: { marginTop: 20, alignSelf: 'stretch', flexDirection: 'row', gap: 10 },
});

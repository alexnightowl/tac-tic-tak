import { achievementCategoryKey, achievementDescKey, achievementMeta, achievementNameKey } from '@tac/core/catalogs';
import { alpha, eos, radii, space, surface, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { Platform, Share, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PROFILE_URL } from '@/features/profile/ProfileScreen';
import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { fontFamily } from '@/ui/fonts';
import { useLang, useT } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { achievementsQuery } from './api';
import { medalArt, TIER_CHIP } from './art';
import { formatUnlockDate } from './AchievementsGrid';
import { Medal } from './Medal';
import './icons';

/** Sheet ground: warm top fading into the shade by 45 % (unlocked only). */
const WARM = `linear-gradient(180deg, ${tone.warmTop} 0%, ${surface.sheet} 45%)`;
const HALO = `radial-gradient(circle at 50% 50%, ${alpha(tone.gold, 0.22)}, ${alpha(tone.gold, 0)} 65%)`;

/**
 * Achievement detail (formSheet `achievement/[slug]`, design v2
 * MobAchievementSheet): the 120 pt medal, tier · category chip, name,
 * criterion; unlocked adds the date well and Share. Reads the grid's cached
 * list; a deep link without it fetches. Swipe down closes it.
 */
export function AchievementSheet({ slug }: { slug: string }) {
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

  const share = () => {
    const url = me ? PROFILE_URL(me.nickname) : '';
    const message = t('achv.share_message', { name });
    void Share.share(Platform.OS === 'ios' && url ? { url, message } : { message: url ? `${message} ${url}` : message });
  };

  return (
    <View
      style={[styles.root, unlocked && styles.warm, styles.bottom]}
      testID="screen-achievement"
    >
      {unlocked ? <View pointerEvents="none" style={styles.halo} /> : null}
      <View pointerEvents="none" style={styles.grabber} />
      <Medal slug={slug} unlocked={unlocked} disc={120} lockBadge />
      <View style={[styles.chip, { backgroundColor: chip.bg }]} testID="achievement-tier">
        <AppText variant="tabLabel" color={chip.fg} style={[styles.chipText, { fontFamily: fontFamily(lang, 'body', 800) }]}>
          {category ? `${t(`achv.tier.${tier}`)} · ${category}` : t(`achv.tier.${tier}`)}
        </AppText>
      </View>
      <AppText variant="heading" style={styles.title} accessibilityRole="header" testID="achievement-name">
        {name}
      </AppText>
      <AppText variant="body" color={eos.ash} style={styles.desc}>
        {t(achievementDescKey(slug))}
      </AppText>
      {unlocked ? (
        <>
          <View style={styles.well}>
            <AppText variant="label">{t('achv.unlocked_label')}</AppText>
            <AppText variant="bodyStrong" style={styles.wellValue} testID="achievement-state">
              {a?.unlockedAt ? formatUnlockDate(a.unlockedAt, lang) : '—'}
            </AppText>
          </View>
          <Tap
            testID="achievement-share"
            accessibilityRole="button"
            accessibilityLabel={t('achv.share')}
            onPress={share}
            style={styles.share}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={eos.bone} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
            </Svg>
            <AppText variant="bodyStrong">{t('achv.share')}</AppText>
          </Tap>
        </>
      ) : (
        <AppText variant="caption" color={eos.dust} style={styles.lockedHint} testID="achievement-state">
          {t('achv.locked_hint')}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // No flex: the fitToContents sheet measures this view.
  root: {
    alignItems: 'center',
    paddingHorizontal: space[6],
    paddingTop: 44,
    overflow: 'hidden',
    backgroundColor: surface.sheet,
    borderTopLeftRadius: radii.sheetLg,
    borderTopRightRadius: radii.sheetLg,
  },
  // The sheet already sits above the home indicator (the canvas' 50 = 16 + 34).
  bottom: { paddingBottom: space[4] },
  warm: { backgroundImage: WARM },
  halo: {
    position: 'absolute',
    top: -60,
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundImage: HALO,
  },
  grabber: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: surface.grabberGlass,
  },
  chip: { marginTop: 18, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.full },
  chipText: { fontSize: 11, lineHeight: 15, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { marginTop: 10, textAlign: 'center', letterSpacing: 0 },
  desc: { marginTop: 6, maxWidth: 300, lineHeight: 21, textAlign: 'center' },
  well: {
    marginTop: 18,
    alignSelf: 'stretch',
    alignItems: 'center',
    padding: space[3],
    borderRadius: radii.cardComponent,
    backgroundColor: eos.well,
  },
  wellValue: { marginTop: space[1], fontSize: 15 },
  share: {
    marginTop: space[4],
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radii.full,
    backgroundColor: eos.slate,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: surface.glassBorder, inset: true }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  lockedHint: { marginTop: 18, textAlign: 'center' },
});

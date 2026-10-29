import { localeFor, streakState } from '@tac/core/format';
import { eos, layout, radii, semantic, space, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { TABULAR } from '@/features/play/ui';
import { useAppStore } from '@/stores/appStore';
import { AppText, useLang, useT } from '@/ui';
import { Tap } from '@/ui/Tap';

/** The canvas streak flame (24-unit box, even-odd); onboarding's habit card uses it too. */
export const FLAME_PATH =
  'M12 23C7.6 23 4.5 20 4.5 15.8C4.5 12.6 6.2 10.4 7.6 9C7.6 10.8 8.2 12 9.4 12.6C8.9 8.6 10.6 4.6 14.2 1.2C13.6 4.8 14.6 7.6 16.4 9.8C17.2 10.8 17.6 11.8 17.6 12.6C18.4 12 18.8 11 18.9 10.2C20.2 11.8 20.5 13.6 20.5 15.4C20.5 19.8 16.8 23 12 23ZM12.4 22.2C10.4 22.2 9.2 20.9 9.2 19.4C9.2 17.9 10.3 16.9 11.1 16.2C11.2 17.2 11.7 17.8 12.3 18C12.2 16.7 12.9 15.4 14.2 14.4C14.1 15.8 14.9 16.9 15.4 17.8C15.7 18.4 15.8 19 15.8 19.5C15.8 21.1 14.3 22.2 12.4 22.2Z';
/** MobStreakSheet's freeze glyph (the canvas's snowflake, 16 pt, stroke 2). */
const SNOWFLAKE_PATH = 'M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4';
/** MobStreakSheet bottom padding; the native sheet already adds the home-indicator inset. */
const PAD_BOTTOM = 40;

/**
 * /streak formSheet (mobile-only; the web had just the badge): the count,
 * what today means for it, the freeze, and the rules in one breath.
 */
export function StreakSheet() {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
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
    <View style={[styles.root, { paddingBottom: Math.max(0, PAD_BOTTOM - insets.bottom) }]} testID="screen-streak">
      <View style={styles.close}>
        <Tap testID="screen-streak-close" accessibilityRole="button" accessibilityLabel={t('play.close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))} style={styles.closeBtn}>
          <X size={22} color={eos.bone} />
        </Tap>
      </View>
      <AppText variant="label" style={[styles.center, styles.title]} accessibilityRole="header" testID="screen-streak-title">
        {t('streak.title')}
      </AppText>
      <View style={styles.hero} accessible accessibilityLabel={`${t('streak.title')}: ${days}`}>
        {/* MobStreakSheet draws the flame in #c64a44 in every state; the number carries it. */}
        <Svg width={40} height={40} viewBox="0 0 24 24">
          <Path d={FLAME_PATH} fill={tone.flame} fillRule="evenodd" />
        </Svg>
        <AppText variant="display" lang="en" color={lit ? eos.bone : eos.ash} style={[TABULAR, styles.days]} testID="streak-days">
          {String(days)}
        </AppText>
      </View>
      <AppText variant="body" color={eos.bone} style={styles.center} testID={`streak-state-${st}`}>
        {stateText}
      </AppText>
      {freezeText && (
        <View style={styles.freeze} testID="streak-freeze">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d={SNOWFLAKE_PATH} stroke={tone.sage} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
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
  root: { paddingHorizontal: layout.gutter, paddingTop: space[8], gap: space[4], backgroundColor: eos.shade },
  close: { position: 'absolute', top: space[2], right: space[2], zIndex: 1 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  // The h2's normal line height (Manrope 11 → 15); RN's natural one is shorter.
  title: { lineHeight: 15 },
  // RN sets Cinzel 44/46 ~7 pt higher in its line than the browser does
  // (the habit card in onboarding compensates the same way).
  days: { transform: [{ translateY: 7 }] },
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

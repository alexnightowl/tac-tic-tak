import type { StormWeekRow } from '@tac/core/storm';
import { alpha, eos, layout, mixed, radii, space, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { BarChart3, Clock3 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { BackLink } from '@/features/courses/parts';
import { plural } from '@/features/offline/format';
import { Avatar } from '@/features/profile/Avatar';
import { AppText, Card, PlateButton, Tap, useLang } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { useStormSummary } from './api';
import { nameOf, shortDate } from './format';
import { Bolt, NumberTile, StormEmblem } from './parts';

// /storm (canvas StormStart): the rules, Your best, Today, the week among
// friends (top 3, plus me as a 4th row when I am outside them) and Start.
// The summary is a persisted query, so a cold start offline still shows the
// last numbers; Start needs the network (the runner says so if it fails).

const RULE_ICON = 18;

export function StartScreen() {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const q = useStormSummary();
  const sum = q.data;

  const rules: { key: string; icon: ReactNode }[] = [
    { key: 'clock', icon: <Clock3 size={RULE_ICON} color={tone.rose} strokeWidth={1.8} /> },
    { key: 'ladder', icon: <BarChart3 size={RULE_ICON} color={tone.rose} strokeWidth={1.8} /> },
    { key: 'combo', icon: <Bolt size={RULE_ICON} color={tone.rose} /> },
    { key: 'lives', icon: <HeartOutline /> },
  ];

  const week = sum?.week ?? [];
  const top = week.slice(0, 3).map((row, i) => ({ row, pos: i + 1 }));
  const mePos = week.findIndex((r) => r.me);
  if (mePos >= 3) top.push({ row: week[mePos], pos: mePos + 1 });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="storm-start">
      <View style={styles.header}>
        <BackLink testID="storm-back" label={t('storm.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/play' as Href))} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + 56 + space[6] + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <StormEmblem />
          <View style={styles.flex}>
            <AppText variant="heading" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
              {t('storm.title')}
            </AppText>
            <AppText variant="body" color={eos.ash} style={styles.tagline}>
              {t('storm.tagline')}
            </AppText>
          </View>
        </View>

        <Card padding={0} style={styles.rules} testID="storm-rules">
          {rules.map((r, i) => (
            <View key={r.key} style={[styles.rule, i > 0 && styles.ruleSeam]} accessible accessibilityLabel={`${t(`storm.rule.${r.key}`)}. ${t(`storm.rule.${r.key}_sub`)}`}>
              <View style={styles.ruleIcon}>{r.icon}</View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{t(`storm.rule.${r.key}`)}</AppText>
                <AppText variant="caption" color={eos.ash} style={styles.ruleSub}>
                  {t(`storm.rule.${r.key}_sub`)}
                </AppText>
              </View>
            </View>
          ))}
        </Card>

        <View style={styles.tiles}>
          <NumberTile
            hero
            testID="storm-best"
            label={t('storm.best')}
            value={sum?.best ? String(sum.best.score) : '—'}
            sub={sum?.best ? shortDate(sum.best.at, lang) : t('storm.best_none')}
          />
          <NumberTile
            testID="storm-today"
            label={t('storm.today')}
            value={sum ? String(sum.today.best) : '—'}
            sub={plural(tn, 'storm.runs', sum?.today.runs ?? 0)}
          />
        </View>

        <View>
          <View style={styles.weekHead}>
            <AppText variant="navTitle" style={styles.weekTitle} accessibilityRole="header">
              {t('storm.week')}
            </AppText>
            <Tap
              testID="storm-week-all"
              accessibilityRole="link"
              accessibilityLabel={t('storm.week_all_a11y')}
              onPress={() => router.push('/storm/friends' as Href)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <AppText variant="bodyStrong" style={styles.allLink}>
                {t('storm.week_all')}
              </AppText>
            </Tap>
          </View>
          <Card padding={0} style={styles.week} testID="storm-week">
            {top.length === 0 ? (
              <AppText variant="caption" color={eos.ash} style={styles.weekEmpty} testID="storm-week-empty">
                {sum ? t('storm.week_empty') : ' '}
              </AppText>
            ) : (
              top.map(({ row, pos }, i) => <WeekRow key={row.user.id} row={row} pos={pos} seam={i > 0} />)
            )}
          </Card>
        </View>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: Math.max(space[6], insets.bottom) }]} pointerEvents="box-none">
        <LinearGradient
          pointerEvents="none"
          colors={[mixed.ctaDockBottom, mixed.ctaDockMid, mixed.ctaDockFade, 'transparent']}
          locations={[0, 0.55, 0.8, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <PlateButton
          testID="storm-start-run"
          label={t('storm.start')}
          icon={<Bolt size={18} color={tone.plateInk} />}
          size="lg"
          block
          onPress={() => router.push('/storm/run' as Href)}
        />
      </View>
    </View>
  );
}

function HeartOutline() {
  return (
    <Svg width={RULE_ICON} height={RULE_ICON} viewBox="0 0 24 24" fill="none" stroke={tone.rose} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </Svg>
  );
}

/** One "this week" row: place, avatar, name ("(you)" on mine, highlighted), score. */
export function WeekRow({ row, pos, seam }: { row: StormWeekRow; pos: number; seam: boolean }) {
  const t = useT();
  const name = row.me ? t('storm.you', { name: nameOf(row.user) }) : nameOf(row.user);
  return (
    <View
      style={[styles.row, seam && styles.ruleSeam, row.me && styles.rowMe]}
      testID={row.me ? 'storm-week-me' : `storm-week-${pos}`}
      accessible
      accessibilityLabel={t('storm.row_a11y', { pos, name, score: row.score })}
    >
      <AppText variant="captionStrong" color={eos.ash} style={styles.pos}>
        {String(pos)}
      </AppText>
      <Avatar nickname={row.user.nickname} avatarUrl={row.user.avatarUrl} size={32} />
      <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
        {name}
      </AppText>
      <AppText variant="bodyStrong" style={styles.score}>
        {String(row.score)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center' },
  content: { paddingHorizontal: layout.gutter, paddingTop: space[1], gap: 18 },
  flex: { flex: 1, minWidth: 0 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space[3.5] },
  tagline: { marginTop: space[1] },
  rules: { overflow: 'hidden' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[3.5] },
  ruleSeam: { borderTopWidth: 1, borderTopColor: eos.rise },
  ruleIcon: { width: 36, height: 36, borderRadius: radii.lg, backgroundColor: eos.rise, alignItems: 'center', justifyContent: 'center' },
  ruleSub: { marginTop: space[0.5] },
  tiles: { flexDirection: 'row', gap: space[2.5] },
  weekHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  weekTitle: { fontSize: 16, flexShrink: 1 },
  allLink: { fontSize: 13, textDecorationLine: 'underline', textDecorationColor: eos.ember },
  week: { marginTop: space[2.5], overflow: 'hidden' },
  weekEmpty: { padding: space[3.5] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2.5], paddingHorizontal: space[3.5] },
  rowMe: { backgroundColor: alpha(eos.ember, 0.12) },
  pos: { width: 18, fontSize: 13 },
  score: { fontSize: 16, fontVariant: ['tabular-nums'] },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space[6] },
});

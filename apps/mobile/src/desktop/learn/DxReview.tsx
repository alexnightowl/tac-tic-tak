import { formatSessionTime, groupSessionsByDay, type SessionRow } from '@tac/core/format';
import { isTrainingStyle } from '@tac/core/rules';
import { themeLabel } from '@tac/core/themes';
import { alpha, eos, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { ChevronRight, RefreshCw, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { reviewApi, reviewKeys, sessionApi } from '@/features/review/api';
import { ThemeIcon } from '@/features/review/ThemeIcon';
import { useReviewThemes, type ThemeRow } from '@/features/review/useReviewThemes';
import { sessionThemeLabel } from '@/features/sessions/format';
import { plural } from '@/features/offline/format';
import { useRawWindow } from '@/platform/webFrame';
import { PlateButton } from '@/ui';
import { useLang, useT, useTn } from '@/ui/lang';
import { Card, DText, Hover, Label, RowRule, Seg, Title } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { colWidth, usePageWidth } from './parts';

// /review on a desktop window (canvas DXReview): "N waiting" with Review
// all, the theme cards (most first, or hardest first), and the latest
// sessions on the right. The data and the card tap are the phone page's
// (useReviewThemes); "Review all" is the drill without a theme.

type Sort = 'most' | 'hardest';
const DASHES = 4;
const HISTORY_ROWS = 5;

export function DxReview() {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const { q, opening, open } = useReviewThemes();
  const all = useQuery({ queryKey: reviewKeys.list(undefined), queryFn: () => reviewApi.list() });
  const [sort, setSort] = useState<Sort>('most');
  const { width: winW } = useRawWindow();
  const asideW = winW < 1280 ? 300 : 360;
  const w = usePageWidth(asideW);

  const rows = q.data ?? [];
  const sorted = sort === 'hardest' ? [...rows].sort((a, b) => b.minRating - a.minRating) : rows;
  const waiting = all.data?.length ?? null;
  const first = all.data?.[0]?.puzzleId ?? null;
  const cols = w >= 600 ? 3 : w >= 460 ? 2 : 1;
  const cardW = colWidth(w, cols, 12);

  return (
    <DesktopPage
      testID="dx-review"
      title={t('review.title')}
      subtitle={t('review.subtitle_themes')}
      asideWidth={asideW}
      aside={<History />}
    >
      <View>
        <Card texture style={styles.hero} testID="dx-review-hero">
          <View style={styles.heroText}>
            <Title size={22}>{waiting === 0 ? t('review.empty') : plural(tn, 'learn.review_entry.waiting', waiting ?? rows.reduce((n, r) => n + r.count, 0))}</Title>
            <DText size={14} color={dx.ash} style={styles.mt4}>
              {waiting === 0 ? t('review.empty_hint') : t('dx.learn.review_hint')}
            </DText>
          </View>
          {first ? (
            <PlateButton
              testID="dx-review-all"
              label={t('dx.learn.review_all')}
              size="lg"
              icon={<RefreshCw size={16} color={tone.onEmber} strokeWidth={2} />}
              onPress={() => router.push(`/review/${encodeURIComponent(first)}` as Href)}
              style={styles.heroCta}
            />
          ) : null}
        </Card>

        <View style={styles.themesHead}>
          <Label>{t('dx.learn.by_theme')}</Label>
          <View style={styles.flex} />
          <Seg<Sort>
            small
            testID="dx-review-sort"
            accessibilityLabel={t('dx.learn.sort_a11y')}
            options={[
              { value: 'most', label: t('dx.learn.sort.most') },
              { value: 'hardest', label: t('dx.learn.sort.hardest') },
            ]}
            value={sort}
            onChange={setSort}
            style={styles.sort}
          />
        </View>

        {q.isPending ? (
          <View style={styles.center} testID="dx-review-loading">
            <ActivityIndicator color={eos.ash} />
          </View>
        ) : q.isError && !q.data ? (
          <View style={styles.center} testID="dx-review-error">
            <DText size={14} color={dx.ash}>
              {t('review.error_title')}
            </DText>
            <PlateButton testID="dx-review-retry" label={t('review.retry_load')} variant="slate" size="sm" onPress={() => void q.refetch()} />
          </View>
        ) : (
          <View style={styles.grid}>
            {w > 0
              ? sorted.map((row) => (
                  <ThemeCard key={row.slug} row={row} width={cardW} opening={opening === row.slug} onPress={() => void open(row)} lang={lang} />
                ))
              : null}
            {rows.length === 0 ? (
              <DText size={14} color={dx.dust} style={styles.empty} testID="dx-review-empty">
                {t('review.empty_hint')}
              </DText>
            ) : null}
          </View>
        )}
      </View>
    </DesktopPage>
  );
}

function ThemeCard({ row, width, opening, onPress, lang }: { row: ThemeRow; width: number; opening: boolean; onPress: () => void; lang: 'en' | 'uk' }) {
  const t = useT();
  const tn = useTn();
  const label = themeLabel(row.slug, lang);
  const noun = tn('review.puzzle_word', row.count);
  return (
    <Hover
      testID={`dx-review-theme-${row.slug}`}
      accessibilityLabel={t('review.theme_card_a11y', { theme: label, count: row.count, noun, rating: row.minRating })}
      onPress={onPress}
      style={[styles.theme, { width }]}
      hoverStyle={styles.themeHover}
    >
      <View style={styles.themeTop}>
        <View style={styles.themeIcon}>
          <ThemeIcon slug={row.slug} size={20} color={tone.roseSoft} />
        </View>
        <View style={styles.flex}>
          <DText size={14.5} weight={800}>
            {label}
          </DText>
          <DText size={12} color={dx.dust} tabular testID={`dx-review-theme-${row.slug}-meta`}>
            {`${row.count} ${noun} · ${t('review.theme_from')} ${row.minRating}`}
          </DText>
        </View>
        {opening ? <ActivityIndicator color={eos.ember} size="small" /> : null}
      </View>
      <View style={styles.dashes}>
        {Array.from({ length: DASHES }, (_, i) => (
          <View key={i} style={[styles.dash, { backgroundColor: i < row.count ? eos.ember : dx.ghost }]} />
        ))}
      </View>
    </Hover>
  );
}

/** The latest sessions (GET /analytics, as the history page): a row opens the session, its pill the mistakes. */
function History() {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const q = useQuery({ queryKey: reviewKeys.overview(), queryFn: () => sessionApi.overview() });
  const rows = (q.data?.recentSessions ?? []).slice(0, HISTORY_ROWS);
  return (
    <Card style={styles.history} testID="dx-review-history">
      <Hover
        testID="dx-review-history-all"
        accessibilityRole="link"
        accessibilityLabel={t('review.history_link')}
        onPress={() => router.push('/sessions' as Href)}
        style={styles.historyHead}
      >
        <Label>{t('review.history_link')}</Label>
        <View style={styles.flex} />
        <ChevronRight size={16} color={dx.ash} strokeWidth={2} />
      </Hover>
      {q.isPending ? (
        <ActivityIndicator color={eos.ash} style={styles.mt12} />
      ) : rows.length === 0 ? (
        <DText size={13} color={dx.dust} style={styles.mt12}>
          {t('dx.learn.history_empty')}
        </DText>
      ) : (
        <View style={styles.mt6}>
          {rows.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <RowRule /> : null}
              <HistoryRow row={r} lang={lang} t={t} tn={tn} />
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function HistoryRow({ row, lang, t, tn }: { row: SessionRow; lang: 'en' | 'uk'; t: ReturnType<typeof useT>; tn: ReturnType<typeof useTn> }) {
  const style = row.style && isTrainingStyle(row.style) ? t(`style.${row.style}.name`) : null;
  const title = [style, sessionThemeLabel(row.theme, lang, t('sessions.mixed'))].filter(Boolean).join(' · ');
  const day = groupSessionsByDay([row], lang)[0]?.[0] ?? '';
  const when = `${day}, ${formatSessionTime(row.startedAt, lang)}`;
  const mistakes = row.failed > 0 ? plural(tn, 'dx.learn.mistakes', row.failed) : t('dx.learn.no_mistakes');
  return (
    <View style={styles.historyRow}>
      <Hover
        testID={`dx-review-session-${row.id}`}
        accessibilityLabel={t('dx.learn.session_a11y', { title, when, mistakes })}
        onPress={() => router.push(`/sessions/${encodeURIComponent(row.id)}` as Href)}
        style={styles.historyMain}
        hoverStyle={styles.historyHover}
      >
        <Zap size={16} color={dx.ash} strokeWidth={1.8} />
        <View style={styles.flex}>
          <DText size={13.5} weight={700} numberOfLines={1}>
            {title}
          </DText>
          <DText size={12} color={dx.dust} numberOfLines={1}>
            {when}
          </DText>
        </View>
      </Hover>
      {row.failed > 0 ? (
        <Hover
          testID={`dx-review-session-${row.id}-mistakes`}
          accessibilityLabel={t('dx.learn.mistakes_a11y')}
          onPress={() => router.push(`/sessions/${encodeURIComponent(row.id)}/review` as Href)}
          style={styles.missPill}
          hoverStyle={styles.missPillHover}
        >
          <DText size={11.5} weight={800} color={dx.rose} numberOfLines={1}>
            {mistakes}
          </DText>
        </Hover>
      ) : (
        <View style={[styles.missPill, styles.cleanPill]}>
          <DText size={11.5} weight={800} color={eos.sage} numberOfLines={1}>
            {mistakes}
          </DText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt12: { marginTop: 12 },
  center: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  hero: { paddingVertical: 24, paddingHorizontal: 26, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 20 },
  heroText: { flex: 1, minWidth: 240 },
  heroCta: { minWidth: 250 },
  themesHead: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  sort: { width: 220 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  empty: { paddingVertical: 24 },
  theme: {
    padding: 16,
    gap: 12,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  themeHover: { backgroundColor: dx.chipHover },
  themeTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  themeIcon: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(eos.ember, 0.2) },
  dashes: { flexDirection: 'row', gap: 4, marginTop: 'auto' },
  dash: { flex: 1, height: 5, borderRadius: 3 },
  history: { paddingVertical: 16, paddingHorizontal: 20 },
  historyHead: { flexDirection: 'row', alignItems: 'center', height: 28, borderRadius: 6 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderRadius: 8 },
  historyHover: { opacity: 0.85 },
  missPill: { height: 24, paddingHorizontal: 9, borderRadius: 999, justifyContent: 'center', backgroundColor: alpha(eos.rose, 0.16) },
  missPillHover: { backgroundColor: alpha(eos.rose, 0.24) },
  cleanPill: { backgroundColor: alpha(eos.sage, 0.14) },
});

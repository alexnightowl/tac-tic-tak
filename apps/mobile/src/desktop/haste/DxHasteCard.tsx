import type { HasteResponse } from '@tac/core/api';
import { localeFor } from '@tac/core/format';
import { UI_STYLE_ORDER } from '@tac/core/rules';
import { alpha, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { Gauge, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { fmtSecs, hasteQuery, hasteTrend, pct, weekLabel } from '@/features/haste/model';
import { useLang, useT, type TFn } from '@/ui/lang';
import { Bar, Card, DText, Label } from '../kit';
import { dx } from '../tokens';
import { STYLE_GLYPH } from '../home/styleGlyph';

const WEEK_H = 84;

/**
 * Stats on a desktop window: the "Haste" card (D40), full width under the
 * radar / time pair. The share of hasty mistakes in 30 days with its trend,
 * the split by style, eight weekly bars, and the threshold rule.
 */
export function DxHasteCard() {
  const t = useT();
  const q = useQuery(hasteQuery());
  const [w, setW] = useState(0);
  const narrow = w > 0 && w < 760;
  const d = q.data;
  if (q.isError && !d) return null;
  return (
    <Card style={styles.card} testID="dx-stats-haste">
      <View style={StyleSheet.absoluteFill} onLayout={(e) => setW(e.nativeEvent.layout.width)} pointerEvents="none" />
      <View style={styles.head}>
        <Gauge size={14} color={dx.ash} strokeWidth={1.8} />
        <Label>{t('haste.title')}</Label>
      </View>
      {!d ? (
        <View style={styles.ph} />
      ) : d.total.mistakes === 0 ? (
        <DText size={13.5} color={dx.dust} style={styles.empty} testID="dx-stats-haste-empty">
          {t('haste.empty')}
        </DText>
      ) : (
        <View style={[styles.cols, narrow && styles.stack]}>
          <Share d={d} t={t} />
          <ByStyle d={d} t={t} />
          <Weeks d={d} t={t} />
        </View>
      )}
      {d ? <Rule d={d} t={t} /> : null}
    </Card>
  );
}

function Share({ d, t }: { d: HasteResponse; t: TFn }) {
  const trend = hasteTrend(d.total, d.previous);
  const ink = !trend || trend.dir === 'same' ? dx.ash : trend.dir === 'down' ? dx.sage : dx.rose;
  const Icon = trend?.dir === 'up' ? TrendingUp : TrendingDown;
  return (
    <View style={styles.col}>
      <DText size={44} weight={800} ls={-0.3} tabular testID="dx-stats-haste-share">
        {`${pct(d.total.share)}%`}
      </DText>
      <DText size={13} color={dx.ash} style={styles.mt4}>
        {t('haste.share_caption')}
      </DText>
      <DText size={12.5} color={dx.dust} tabular style={styles.mt2}>
        {t('haste.share_of', { hasty: d.total.hasty, mistakes: d.total.mistakes })}
      </DText>
      {trend ? (
        <View style={[styles.trend, { backgroundColor: alpha(ink, 0.12) }]} testID={`dx-stats-haste-trend-${trend.dir}`}>
          {trend.dir !== 'same' ? <Icon size={14} color={ink} strokeWidth={2} /> : null}
          <DText size={12.5} weight={700} color={ink} tabular numberOfLines={2} style={styles.shrink}>
            {t(`haste.trend_${trend.dir}`, { prev: trend.prev })}
          </DText>
        </View>
      ) : null}
    </View>
  );
}

function ByStyle({ d, t }: { d: HasteResponse; t: TFn }) {
  return (
    <View style={styles.col}>
      <Label size={10}>{t('haste.by_style')}</Label>
      {UI_STYLE_ORDER.map((st) => {
        const row = d.byStyle.find((r) => r.style === st);
        const Glyph = STYLE_GLYPH[st];
        return (
          <View key={st} style={styles.styleRow} testID={`dx-stats-haste-style-${st}`}>
            <Glyph size={14} color={dx.ash} strokeWidth={1.8} />
            <DText size={13} color={dx.ash} style={styles.styleName}>
              {t(`style.${st}.name`)}
            </DText>
            <Bar value={row ? row.share : 0} height={8} colors={[dx.goldFrom, tone.gold]} style={styles.flex} />
            <DText size={13} weight={800} tabular align="right" style={styles.styleVal}>
              {row ? t('haste.style_row', { hasty: row.hasty, mistakes: row.mistakes }) : '—'}
            </DText>
          </View>
        );
      })}
    </View>
  );
}

function Weeks({ d, t }: { d: HasteResponse; t: TFn }) {
  const { lang } = useLang();
  const locale = localeFor(lang);
  const last = d.weeks.length - 1;
  return (
    <View style={styles.col} testID="dx-stats-haste-weeks">
      <Label size={10}>{t('haste.weeks')}</Label>
      <View style={styles.weeks}>
        {d.weeks.map((w, i) => (
          <View
            key={w.weekStart}
            style={styles.weekCol}
            accessible
            accessibilityLabel={t('haste.week_a11y', { date: weekLabel(w.weekStart, locale), pct: pct(w.share), hasty: w.hasty, mistakes: w.mistakes })}
          >
            {w.mistakes > 0 ? (
              <DText size={10.5} weight={700} color={i === last ? dx.bone : dx.dust} tabular align="center">
                {`${pct(w.share)}`}
              </DText>
            ) : null}
            <View
              style={[
                styles.weekBar,
                w.mistakes === 0
                  ? styles.weekEmpty
                  : { height: Math.max(4, Math.round(w.share * WEEK_H)), backgroundColor: i === last ? tone.gold : alpha(tone.gold, 0.5) },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.axis}>
        <DText size={11.5} color={dx.dust}>
          {d.weeks[0] ? weekLabel(d.weeks[0].weekStart, locale) : ''}
        </DText>
        <DText size={11.5} color={dx.dust}>
          {d.weeks[last] ? weekLabel(d.weeks[last].weekStart, locale) : ''}
        </DText>
      </View>
    </View>
  );
}

function Rule({ d, t }: { d: HasteResponse; t: TFn }) {
  const { lang } = useLang();
  const s = (ms: number) => fmtSecs(ms, lang, t);
  return (
    <DText size={12.5} color={dx.dust} style={styles.rule} testID="dx-stats-haste-rule">
      {t('haste.rule', { bullet: s(d.thresholdsMs.bullet), blitz: s(d.thresholdsMs.blitz), rapid: s(d.thresholdsMs.rapid) })}
    </DText>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 20, paddingHorizontal: 22 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ph: { height: 140, borderRadius: 10, backgroundColor: dx.track, marginTop: 16 },
  empty: { paddingVertical: 24, textAlign: 'center' },
  cols: { flexDirection: 'row', gap: 32, marginTop: 16 },
  stack: { flexDirection: 'column', gap: 22 },
  col: { flex: 1, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  styleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  styleName: { width: 52 },
  styleVal: { width: 56 },
  weeks: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: WEEK_H + 18, marginTop: 12 },
  weekCol: { flex: 1, justifyContent: 'flex-end', gap: 4 },
  weekBar: { borderRadius: 4 },
  weekEmpty: { height: 4, backgroundColor: dx.track },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  rule: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: dx.rowRule },
});

import type { HasteResponse } from '@tac/core/api';
import { localeFor } from '@tac/core/format';
import { UI_STYLE_ORDER } from '@tac/core/rules';
import { alpha, eos, radii, semantic, space, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { Gauge, TrendingDown, TrendingUp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { StyleIcon, STRONG, TABULAR } from '@/features/play/ui';
import { AppText } from '@/ui';
import { useLang, useT, type TFn } from '@/ui/lang';
import { Card } from '@/ui/Surfaces';
import { fmtSecs, hasteQuery, hasteTrend, pct, weekLabel } from './model';

const BAR_H = 44;

/**
 * Stats (phone): the "Haste" card (D40). Share of hasty mistakes over 30
 * days, the trend against the 30 days before, the split by style, eight
 * weekly bars and the threshold rule.
 */
export function HasteCard() {
  const t = useT();
  const q = useQuery(hasteQuery());
  const d = q.data;
  if (!d) {
    if (q.isError) return null;
    return (
      <Card style={styles.card} testID="stats-haste">
        <AppText variant="label">{t('haste.title')}</AppText>
        <View style={styles.ph} />
      </Card>
    );
  }
  return (
    <Card style={styles.card} testID="stats-haste">
      <View style={styles.head}>
        <Gauge size={14} color={eos.ash} />
        <AppText variant="label">{t('haste.title')}</AppText>
      </View>
      {d.total.mistakes === 0 ? (
        <AppText variant="body" color={eos.dust} testID="stats-haste-empty">
          {t('haste.empty')}
        </AppText>
      ) : (
        <HasteBody d={d} t={t} />
      )}
      <HasteRule d={d} t={t} />
    </Card>
  );
}

function HasteBody({ d, t }: { d: HasteResponse; t: TFn }) {
  const trend = hasteTrend(d.total, d.previous);
  const good = trend?.dir === 'down';
  const TrendIcon = trend?.dir === 'up' ? TrendingUp : TrendingDown;
  const trendInk = trend?.dir === 'same' ? eos.ash : good ? eos.sage : eos.rose;
  return (
    <>
      <View style={styles.hero}>
        <AppText variant="value" style={[styles.big, TABULAR]} testID="stats-haste-share">
          {`${pct(d.total.share)}%`}
        </AppText>
        <View style={styles.flex}>
          <AppText variant="caption" color={eos.ash}>
            {t('haste.share_caption')}
          </AppText>
          <AppText variant="caption" color={eos.dust} style={TABULAR}>
            {t('haste.share_of', { hasty: d.total.hasty, mistakes: d.total.mistakes })}
          </AppText>
        </View>
      </View>
      {trend ? (
        <View style={styles.trend} testID={`stats-haste-trend-${trend.dir}`}>
          {trend.dir !== 'same' ? <TrendIcon size={14} color={trendInk} /> : null}
          <AppText variant="caption" color={trendInk} style={TABULAR}>
            {t(`haste.trend_${trend.dir}`, { prev: trend.prev })}
          </AppText>
        </View>
      ) : null}

      {d.byStyle.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="label">{t('haste.by_style')}</AppText>
          {UI_STYLE_ORDER.map((st) => {
            const row = d.byStyle.find((r) => r.style === st);
            if (!row) return null;
            return (
              <View key={st} style={styles.styleRow} testID={`stats-haste-style-${st}`}>
                <StyleIcon style={st} size={14} color={eos.ash} />
                <AppText variant="caption" color={eos.bone} style={styles.styleName}>
                  {t(`style.${st}.name`)}
                </AppText>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max(2, pct(row.share))}%` }]} />
                </View>
                <AppText variant="caption" color={eos.ash} style={[styles.styleVal, TABULAR]}>
                  {t('haste.style_row', { hasty: row.hasty, mistakes: row.mistakes })}
                </AppText>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="label">{t('haste.weeks')}</AppText>
        <HasteWeeks weeks={d.weeks} t={t} />
      </View>
    </>
  );
}

/** Eight weekly bars of the hasty share (a faint stub for a week without mistakes). */
export function HasteWeeks({ weeks, t, height = BAR_H }: { weeks: HasteResponse['weeks']; t: TFn; height?: number }) {
  const { lang } = useLang();
  const locale = localeFor(lang);
  const last = weeks.length - 1;
  return (
    <View testID="stats-haste-weeks">
      <View style={[styles.weeks, { height }]}>
        {weeks.map((w, i) => {
          const label = t('haste.week_a11y', { date: weekLabel(w.weekStart, locale), pct: pct(w.share), hasty: w.hasty, mistakes: w.mistakes });
          return (
            <View key={w.weekStart} style={styles.weekCol} accessible accessibilityLabel={label}>
              <View
                style={[
                  styles.weekBar,
                  w.mistakes === 0
                    ? styles.weekEmpty
                    : { height: Math.max(3, Math.round(w.share * height)), backgroundColor: i === last ? tone.gold : alpha(tone.gold, 0.55) },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.weekAxis}>
        <AppText variant="caption" color={eos.dust}>
          {weeks[0] ? weekLabel(weeks[0].weekStart, locale) : ''}
        </AppText>
        <AppText variant="caption" color={eos.dust}>
          {weeks[last] ? weekLabel(weeks[last].weekStart, locale) : ''}
        </AppText>
      </View>
    </View>
  );
}

/** "Hasty: a wrong move faster than 1.5 s in bullet, …" from the server's thresholds. */
export function HasteRule({ d, t, color = eos.dust }: { d: HasteResponse; t: TFn; color?: string }) {
  const { lang } = useLang();
  const s = (ms: number) => fmtSecs(ms, lang, t);
  return (
    <AppText variant="caption" color={color} style={styles.rule} testID="stats-haste-rule">
      {t('haste.rule', { bullet: s(d.thresholdsMs.bullet), blitz: s(d.thresholdsMs.blitz), rapid: s(d.thresholdsMs.rapid) })}
    </AppText>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  ph: { height: 120, borderRadius: radii.control, backgroundColor: eos.well },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[1] },
  big: { fontSize: 34, lineHeight: 40, ...STRONG },
  flex: { flex: 1, minWidth: 0 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  section: { gap: space[2], marginTop: space[2] },
  styleRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  styleName: { width: 52 },
  track: { flex: 1, height: 6, borderRadius: radii.full, backgroundColor: semantic.borderSoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.full, backgroundColor: tone.gold },
  styleVal: { minWidth: 52, textAlign: 'right' },
  weeks: { flexDirection: 'row', alignItems: 'flex-end', gap: space[1.5] },
  weekCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  weekBar: { borderRadius: 3 },
  weekEmpty: { height: 3, backgroundColor: semantic.borderSoft },
  weekAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[1] },
  rule: { marginTop: space[2] },
});

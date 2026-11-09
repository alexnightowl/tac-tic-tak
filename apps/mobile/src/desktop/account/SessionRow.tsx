import { formatSessionTime, groupSessionsByDay, type SessionRow as Row } from '@tac/core/format';
import { isTrainingStyle } from '@tac/core/rules';
import { router, type Href } from 'expo-router';
import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { pct, responseTime, sessionThemeLabel } from '@/features/sessions/format';
import { StyleIcon } from '@/features/stats/StyleIcon';
import { useLang, useT } from '@/ui/lang';
import { DText, Hover } from '../kit';
import { dx } from '../tokens';

/**
 * A recent-session row on a desktop card, with everything the phone's
 * SessionRow shows: style and theme, the day and start time, solved,
 * accuracy, average answer time, duration, and the rating start → peak
 * with its change. `open` makes it a link to /sessions/:id (session
 * detail is owner-only on the server, so other players' rows are display
 * only). Rows after the first draw a rule above them.
 */
export function DxSessionRow({ row, first, open, testID }: { row: Row; first: boolean; open: boolean; testID?: string }) {
  const t = useT();
  const { lang } = useLang();
  const style = row.style && isTrainingStyle(row.style) ? row.style : null;
  const theme = sessionThemeLabel(row.theme, lang, t('sessions.mixed'));
  const title = [style ? t(`style.${style}.name`) : null, theme].filter(Boolean).join(' · ');
  const day = groupSessionsByDay([row], lang)[0]?.[0] ?? '';
  const time = formatSessionTime(row.startedAt, lang);
  const sub = [
    `${day}, ${time}`,
    `${row.solved} ${t('sessions.row_solved')}`,
    pct(row.accuracy),
    responseTime(row.avgResponseMs),
    t('sessions.minutes', { n: Math.round(row.durationSec / 60) }),
  ].join(' · ');
  const delta = row.peakRating - row.startRating;
  const deltaColor = delta > 0 ? dx.sage : delta < 0 ? dx.rose : dx.ash;
  const Arrow = delta > 0 ? ArrowUpRight : ArrowDownRight;

  const body: ReactNode = (
    <>
      <View style={styles.icon}>{style ? <StyleIcon style={style} size={15} color={dx.ash} /> : null}</View>
      <View style={styles.flex}>
        <DText size={14} weight={700} numberOfLines={1}>
          {title}
        </DText>
        <DText size={12.5} color={dx.dust} numberOfLines={1} tabular style={styles.sub}>
          {sub}
        </DText>
      </View>
      <View style={styles.rating}>
        <DText size={13.5} color={dx.ash} tabular>
          {String(row.startRating)}
        </DText>
        <ChevronRight size={12} color={dx.dust} strokeWidth={2} />
        <DText size={13.5} weight={800} tabular color={delta === 0 ? dx.bone : deltaColor}>
          {String(row.peakRating)}
        </DText>
        <View style={styles.delta}>
          {delta !== 0 ? (
            <>
              <Arrow size={12} color={deltaColor} strokeWidth={2.2} />
              <DText size={12.5} weight={800} tabular color={deltaColor}>
                {`${delta > 0 ? '+' : '−'}${Math.abs(delta)}`}
              </DText>
            </>
          ) : null}
        </View>
      </View>
    </>
  );

  const id = testID ?? `history-open-${row.id}`;
  return open ? (
    <Hover
      testID={id}
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${t('sessions.row_a11y', { time: `${day}, ${time}`, solved: row.solved, start: row.startRating, peak: row.peakRating })}`}
      onPress={() => router.push(`/sessions/${encodeURIComponent(row.id)}` as Href)}
      style={[styles.row, !first && styles.rule]}
    >
      {body}
    </Hover>
  ) : (
    <View style={[styles.row, !first && styles.rule]} testID={`history-row-${row.id}`}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 8 },
  rule: { borderTopWidth: 1, borderTopColor: dx.rowRule },
  icon: { width: 16, alignItems: 'center' },
  sub: { marginTop: 2 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  delta: { width: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 1 },
});

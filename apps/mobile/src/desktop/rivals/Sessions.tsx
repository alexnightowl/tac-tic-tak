import type { Language } from '@tac/core/i18n';
import { formatSessionTime, groupSessionsByDay, type SessionRow as Row } from '@tac/core/format';
import { isTrainingStyle } from '@tac/core/rules';
import { eos } from '@tac/core/tokens';
import { router, Stack, type Href } from 'expo-router';
import { ChevronRight, Trash2 } from 'lucide-react-native';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { pct, responseTime, sessionThemeLabel } from '@/features/sessions/format';
import { HISTORY_PAGINATION, HISTORY_WINDOW } from '@/features/sessions/HistoryScreen';
import { useSessionHistory } from '@/features/sessions/useSessionHistory';
import { StyleIcon } from '@/features/stats/StyleIcon';
import { PlateButton } from '@/ui';
import { useLang, useT, type TFn } from '@/ui/lang';
import { Card, DText, Hover, Label, TextButton } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { useWidth } from './layout';

/** Narrower tables tighten their columns and put the length under the theme. */
const COMPACT_BELOW = 860;

/**
 * /sessions on a desktop window (no artboard; the DX visual language): the
 * history as one table card grouped by day — time, style, theme, solved /
 * failed, accuracy, answer time, rating start → peak — with a delete
 * button per row and the phone's undo bar. Same data and optimistic delete
 * (useSessionHistory).
 */
export function DxSessions() {
  const t = useT();
  const { lang } = useLang();
  const { q, rows, total, onDelete, onUndo, undo } = useSessionHistory();
  const [width, onLayout] = useWidth();
  const compact = width > 0 && width < COMPACT_BELOW;

  let body;
  if (q.isPending) {
    body = <Card style={styles.placeholder} testID="history-loading" />;
  } else if (q.isError && !q.data) {
    body = (
      <Card style={styles.state} testID="history-error">
        <DText size={14} color={dx.ash}>
          {t('sessions.list_error')}
        </DText>
        <TextButton label={t('sessions.retry')} testID="history-retry" accessibilityLabel={t('sessions.retry')} onPress={() => void q.refetch()} />
      </Card>
    );
  } else if (rows.length === 0) {
    body = (
      <Card style={styles.state} testID="history-empty">
        <DText size={14} color={dx.ash}>
          {t('sessions.empty')}
        </DText>
        <PlateButton label={t('sessions.empty_cta')} testID="history-play" variant="ember" size="sm" onPress={() => router.navigate('/play' as Href)} />
      </Card>
    );
  } else {
    body = (
      <Card testID="history-list" style={styles.listCard}>
        <View onLayout={onLayout}>
          <HeadRow t={t} compact={compact} />
        </View>
        {groupSessionsByDay(rows, lang).map(([label, group]) => (
          // One box per day: its header sticks to the top of the page's
          // scroll while the day's rows pass under it (the phone's sticky
          // section headers), and the next day's box pushes it out.
          <View key={label}>
            <View style={[styles.day, sticky]} testID={`history-day-${label}`}>
              <Label size={10.5}>{label}</Label>
            </View>
            {group.map((r) => (
              <SessionLine key={r.id} row={r} lang={lang} t={t} compact={compact} onDelete={onDelete} />
            ))}
          </View>
        ))}
      </Card>
    );
  }

  return (
    <DesktopPage
      title={t('sessions.title')}
      subtitle={!HISTORY_PAGINATION && total >= HISTORY_WINDOW ? t('sessions.recent_note', { n: HISTORY_WINDOW }) : undefined}
      testID="screen-sessions"
    >
      <Stack.Screen options={NO_HEADER} />
      {body}
      {undo ? (
        <View style={styles.undoDock} pointerEvents="box-none">
          <View style={styles.undo} testID="history-undo-bar">
            <DText size={14} style={styles.flex}>
              {t('sessions.deleted')}
            </DText>
            <TextButton label={t('sessions.undo')} color={eos.ember} testID="history-undo" accessibilityLabel={t('sessions.undo')} onPress={onUndo} />
          </View>
        </View>
      ) : null}
    </DesktopPage>
  );
}

function HeadRow({ t, compact }: { t: TFn; compact: boolean }) {
  const c = cols(compact);
  return (
    <View style={[c.row, styles.head]}>
      <Label size={10} style={c.time}>
        {t('dx.rivals.sessions.time')}
      </Label>
      <Label size={10} style={styles.cTheme}>
        {t('dx.rivals.sessions.theme')}
      </Label>
      <Label size={10} style={c.num}>
        {t('sessions.solved')}
      </Label>
      <Label size={10} style={c.num}>
        {t('sessions.accuracy')}
      </Label>
      <Label size={10} style={c.num}>
        {t('sessions.avg_response')}
      </Label>
      <Label size={10} style={c.rating}>
        {t('dx.rivals.sessions.rating')}
      </Label>
      <View style={styles.cActions} />
    </View>
  );
}

/** Column styles at the full or the compact width. */
function cols(compact: boolean) {
  return compact
    ? { row: [styles.row, styles.rowC], time: styles.cTimeC, num: styles.cNumC, rating: styles.cRatingC }
    : { row: styles.row, time: styles.cTime, num: styles.cNum, rating: styles.cRating };
}

function SessionLine({ row, lang, t, compact, onDelete }: { row: Row; lang: Language; t: TFn; compact: boolean; onDelete: (id: string) => void }) {
  const time = formatSessionTime(row.startedAt, lang);
  const style = row.style && isTrainingStyle(row.style) ? row.style : null;
  const delta = row.peakRating - row.startRating;
  const deltaColor = delta > 0 ? dx.sage : delta < 0 ? dx.rose : dx.ash;
  const c = cols(compact);
  const theme = sessionThemeLabel(row.theme, lang, t('sessions.mixed'));
  const length = t('sessions.minutes', { n: Math.round(row.durationSec / 60) });
  return (
    <View style={styles.lineWrap} testID={`history-row-${row.id}`}>
      <Hover
        testID={`history-open-${row.id}`}
        accessibilityLabel={t('sessions.row_a11y', { time, solved: row.solved, start: row.startRating, peak: row.peakRating })}
        onPress={() => router.push(`/sessions/${encodeURIComponent(row.id)}` as Href)}
        style={c.row}
      >
        <DText size={13.5} weight={700} tabular style={c.time}>
          {time}
        </DText>
        <View style={[styles.cTheme, styles.themeCell]}>
          {style ? <StyleIcon style={style} size={14} color={dx.ash} /> : null}
          {compact ? (
            <View style={styles.flex}>
              <DText size={13.5} numberOfLines={1}>
                {theme}
              </DText>
              <DText size={12} color={dx.dust} numberOfLines={1}>
                {length}
              </DText>
            </View>
          ) : (
            <DText size={13.5} numberOfLines={1} style={styles.flex}>
              {`${theme} · ${length}`}
            </DText>
          )}
        </View>
        <DText size={13.5} weight={800} tabular style={c.num}>
          <DText size={13.5} weight={800} color={dx.sage}>
            {String(row.solved)}
          </DText>
          <DText size={13.5} color={dx.dust}>{' / '}</DText>
          <DText size={13.5} weight={800} color={dx.rose}>
            {String(row.failed)}
          </DText>
        </DText>
        <DText size={13.5} weight={700} tabular style={c.num}>
          {pct(row.accuracy)}
        </DText>
        <DText size={13.5} tabular color={dx.ash} style={c.num} testID={`history-avg-${row.id}`}>
          {responseTime(row.avgResponseMs)}
        </DText>
        <View style={[c.rating, styles.ratingCell]}>
          <DText size={13.5} tabular color={dx.ash}>
            {String(row.startRating)}
          </DText>
          <ChevronRight size={12} color={dx.dust} />
          <DText size={13.5} weight={800} tabular>
            {String(row.peakRating)}
          </DText>
          {delta !== 0 ? (
            <DText size={12} weight={800} tabular color={deltaColor}>
              {`${delta > 0 ? '+' : '−'}${Math.abs(delta)}`}
            </DText>
          ) : null}
        </View>
        <View style={styles.cActions} />
      </Hover>
      <Hover
        testID={`history-delete-${row.id}`}
        accessibilityLabel={t('sessions.delete_a11y')}
        onPress={() => onDelete(row.id)}
        style={styles.del}
        hoverStyle={styles.delHover}
      >
        <Trash2 size={15} color={dx.ash} strokeWidth={1.8} />
      </Hover>
    </View>
  );
}

/** The desktop page draws its own header. */
const NO_HEADER = { headerShown: false } as const;

/** The undo bar floats over the page (react-native-web passes `fixed` through). */
const fixed = { position: 'fixed' } as unknown as ViewStyle;
/** Day headers stick inside the page's scroll (web `position: sticky`). */
const sticky = { position: 'sticky', top: 0, zIndex: 2 } as unknown as ViewStyle;

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  placeholder: { height: 320 },
  state: { padding: 28, alignItems: 'center', gap: 14 },
  // `clip` keeps the rounded corners without making the card a scroll box,
  // which would stop the sticky day headers.
  listCard: { overflow: 'clip' } as unknown as ViewStyle,
  head: { paddingVertical: 12 },
  day: { paddingTop: 16, paddingBottom: 8, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: dx.rowRule, backgroundColor: dx.track },
  lineWrap: { borderTopWidth: 1, borderTopColor: dx.rowRule },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 18 },
  cTime: { width: 64 },
  cTheme: { flex: 1, minWidth: 120 },
  themeCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cNum: { width: 104 },
  cRating: { width: 150 },
  ratingCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cActions: { width: 32 },
  rowC: { gap: 10 },
  cTimeC: { width: 54 },
  cNumC: { width: 72 },
  cRatingC: { width: 128 },
  del: { position: 'absolute', right: 14, top: '50%', marginTop: -16, width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  delHover: { backgroundColor: dx.ghostHover },
  undoDock: { ...fixed, left: 0, right: 0, bottom: 28, alignItems: 'center', zIndex: 20 } as ViewStyle,
  undo: {
    width: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 18,
    paddingRight: 6,
    height: 52,
    borderRadius: 14,
    backgroundColor: dx.card2,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true },
      { offsetX: 0, offsetY: 12, blurRadius: 30, spreadDistance: 0, color: dx.popShadow },
    ],
  },
});

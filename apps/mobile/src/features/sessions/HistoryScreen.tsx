import { groupSessionsByDay, type SessionRow as Row } from '@tac/core/format';
import { queryKeys } from '@tac/core/api';
import { eos, keyframes, layout, radii, semantic, space, surface, timing } from '@tac/core/tokens';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { CloudOff, History } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel } from '@/feel';
import { reviewKeys, sessionApi, type OverviewResponse } from '@/features/review/api';
import { Skeleton, StateView } from '@/features/review/states';
import { queryClient } from '@/platform/query';
import { toast } from '@/shell/toast/store';
import { AppText, stackHeader } from '@/ui';
import { useLang, useT } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { SessionRow } from './SessionRow';

/** MobSessions / MobSessionDetail: the `.float` round back button. */
const FLOAT_HEADER = stackHeader('float');

/**
 * B9 (paginated /sessions) is not on the API yet: the history is the
 * dashboard's latest-20 window from GET /analytics, exactly what the web
 * shows. Flip this once the endpoint lands and switch to useInfiniteQuery.
 */
export const HISTORY_PAGINATION = false;
const WINDOW = 20;
/** Undo window (Q15, PROVISIONAL): the toast lifetime. */
const UNDO_MS = timing.toastDismiss;

type Item = { kind: 'header'; label: string } | { kind: 'row'; row: Row };

/** After a delete lands: the web's invalidations (dashboard, analytics, theme stats). */
function invalidateAfterDelete(id: string) {
  queryClient.setQueryData<OverviewResponse>(reviewKeys.overview(), (d) =>
    d ? { ...d, recentSessions: d.recentSessions.filter((s) => s.id !== id) } : d,
  );
  void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analyticsAll() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analyticsThemesAll() });
  queryClient.removeQueries({ queryKey: reviewKeys.session(id) });
}

/**
 * /sessions (push): the history with sticky day headers. Delete is
 * optimistic (Q15): the row leaves at once, an undo bar stays for the toast
 * lifetime, then DELETE /sessions/:id. Leaving the screen commits it.
 */
export function HistoryScreen() {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const q = useQuery({ queryKey: reviewKeys.overview(), queryFn: () => sessionApi.overview() });
  const [refreshing, setRefreshing] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [undo, setUndo] = useState<string | null>(null);
  // The one delete waiting for its undo window (a second delete commits the first).
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const commit = (id: string) => {
    sessionApi.remove(id).then(
      () => {
        invalidateAfterDelete(id);
        setHidden((h) => without(h, id));
      },
      () => {
        // Roll back: the row comes back and the user hears why.
        setHidden((h) => without(h, id));
        toast.show({ title: t('sessions.delete_failed') });
      },
    );
  };

  const flush = () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    commit(p.id);
  };

  const onDelete = (id: string) => {
    flush();
    setHidden((h) => new Set(h).add(id));
    setUndo(id);
    pending.current = {
      id,
      timer: setTimeout(() => {
        pending.current = null;
        setUndo((u) => (u === id ? null : u));
        commit(id);
      }, UNDO_MS),
    };
  };

  const onUndo = () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    setHidden((h) => without(h, p.id));
    setUndo(null);
  };

  // Leaving with a delete in its undo window still deletes.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    feel.emit('refresh');
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const title = <Stack.Screen options={{ title: t('sessions.title'), header: FLOAT_HEADER }} />;

  if (q.isPending) {
    return (
      <View style={styles.root} testID="screen-sessions">
        {title}
        <View style={styles.pad} testID="history-loading">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} style={styles.skeleton} />
          ))}
        </View>
      </View>
    );
  }
  if (q.isError && !q.data) {
    return (
      <View style={styles.root} testID="screen-sessions">
        {title}
        <StateView
          testID="history-error"
          icon={<CloudOff size={24} color={eos.ash} />}
          title={t('sessions.list_error')}
          action={{ label: t('sessions.retry'), testID: 'history-retry', onPress: () => void q.refetch() }}
          style={styles.flex}
        />
      </View>
    );
  }

  const rows = (q.data?.recentSessions ?? []).filter((r) => !hidden.has(r.id));
  const items: Item[] = [];
  const sticky: number[] = [];
  for (const [label, group] of groupSessionsByDay(rows, lang)) {
    sticky.push(items.length);
    items.push({ kind: 'header', label });
    for (const row of group) items.push({ kind: 'row', row });
  }
  const total = q.data?.recentSessions.length ?? 0;

  return (
    <View style={styles.root} testID="screen-sessions">
      {title}
      <FlashList
        data={items}
        keyExtractor={(it) => (it.kind === 'header' ? `h:${it.label}` : it.row.id)}
        getItemType={(it) => it.kind}
        stickyHeaderIndices={sticky}
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <View style={styles.dayHeader} testID={`history-day-${item.label}`}>
              <AppText variant="sectionLabel">{item.label}</AppText>
            </View>
          ) : (
            <View style={styles.rowWrap}>
              <SessionRow row={item.row} lang={lang} t={t} onDelete={onDelete} />
            </View>
          )
        }
        ListEmptyComponent={
          <StateView
            testID="history-empty"
            icon={<History size={24} color={eos.ash} />}
            title={t('sessions.empty')}
            action={{ label: t('sessions.empty_cta'), testID: 'history-play', variant: 'ember', onPress: () => router.dismissTo('/play' as Href) }}
          />
        }
        ListFooterComponent={
          !HISTORY_PAGINATION && total >= WINDOW ? (
            <AppText variant="caption" style={styles.footer} testID="history-window-note">
              {t('sessions.recent_note', { n: WINDOW })}
            </AppText>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + space[20] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={eos.ember} colors={[eos.ember]} />}
        // No anchoring: an undone delete or a refetch must not shift the list.
        maintainVisibleContentPosition={{ disabled: true }}
        testID="history-list"
      />
      {undo ? (
        <Animated.View
          key={undo}
          entering={reduced ? undefined : FadeInDown.duration(keyframes.slideInRight.duration)}
          exiting={reduced ? undefined : FadeOutDown.duration(keyframes.slideInRight.duration)}
          style={[styles.undoBar, { bottom: insets.bottom + space[4] }]}
          testID="history-undo-bar"
        >
          <AppText variant="body" style={styles.flex}>
            {t('sessions.deleted')}
          </AppText>
          <Tap testID="history-undo" accessibilityRole="button" accessibilityLabel={t('sessions.undo')} onPress={onUndo} style={styles.undoBtn}>
            <AppText variant="label" color={eos.ember}>
              {t('sessions.undo')}
            </AppText>
          </Tap>
        </Animated.View>
      ) : null}
    </View>
  );
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1 },
  pad: { padding: layout.gutter, gap: space[2.5] },
  skeleton: { height: space[16] + space[2] },
  dayHeader: { paddingHorizontal: layout.gutter, paddingTop: space[4], paddingBottom: space[2], backgroundColor: eos.ink },
  rowWrap: { paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  footer: { textAlign: 'center', paddingVertical: space[4] },
  undoBar: {
    position: 'absolute',
    left: layout.gutter,
    right: layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingLeft: space[4],
    paddingRight: space[1],
    minHeight: space[12] + space[2],
    borderRadius: radii['2xl'],
    backgroundColor: surface.floatCard,
    borderWidth: 1,
    borderColor: semantic.borderStrong,
  },
  undoBtn: { minWidth: space[16], height: space[11], alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[3] },
});

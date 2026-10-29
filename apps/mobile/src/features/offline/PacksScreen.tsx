import { FLIGHT_PACK_COUNT, OFFLINE_PACK_KINDS, TOP_UP_TARGET, type OfflinePackKind } from '@tac/core/offline';
import { eos, layout, radii, space, tone } from '@tac/core/tokens';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Check, ChevronLeft, Download, Plane, RefreshCw, WifiOff } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { E2E } from '@/features/review/practice/E2EStrip';
import { useIsOffline } from '@/shell/OfflineBanner';
import { useShellStore } from '@/shell/store';
import { AppText, DangerButton, HeroCard, MiniButton, PlateButton, SectionLabel, Sheet, Tap, Toggle, useLang } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { formatSize, PACK_SWATCH, packMeta, packTitle, plural, SWATCH_EMPTY } from './format';
import { DOWNLOAD_CREEP, downloadCreepTiming } from './motion';
import { packBytes, unplayedOf, useOfflineStore, type DownloadState, type PackKey } from './store';
import { cancelDownload, downloadPack, requestSync } from './sync';

// /offline (OfflinePacks artboard): what is on the phone, the Wi-Fi top-up
// switch, the downloadable packs plus the automatic Review pack, and the
// "Flight pack" CTA. A saved pack's row opens the offline runner.

const ROWS: readonly PackKey[] = [...OFFLINE_PACK_KINDS, 'review'];
const DOCK_H = layout.plateHeight.lg + space[6] + space[4];

export function PacksScreen() {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();
  const params = useLocalSearchParams<{ from?: string }>();
  const packs = useOfflineStore((s) => s.packs);
  const review = useOfflineStore((s) => s.review);
  const queue = useOfflineStore((s) => s.queue);
  const downloads = useOfflineStore((s) => s.downloads);
  const topUpOn = useOfflineStore((s) => s.topUp);
  const reviewLoading = useOfflineStore((s) => s.reviewLoading);
  const sync = useOfflineStore((s) => s.sync);
  const [removing, setRemoving] = useState<OfflinePackKind | null>(null);

  // Opening the screen online refreshes the Review pack and flushes the queue.
  useEffect(() => {
    void requestSync('manual');
  }, []);

  const rows = useMemo(() => {
    const st = { packs, review, queue };
    return ROWS.map((key) => {
      const pack = key === 'review' ? review : (packs[key] ?? null);
      const left = unplayedOf(st, key).length;
      return { key, pack, left, bytes: packBytes(pack) };
    });
  }, [packs, review, queue]);

  const total = rows.reduce((n, r) => n + (r.pack ? r.left : 0), 0);
  const bytes = rows.reduce((n, r) => n + r.bytes, 0);
  const segments = rows.filter((r) => r.pack && r.left > 0);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/play' as Href);
  };
  const open = (key: PackKey) => router.push(`/offline/solve?pack=${key}` as Href);

  return (
    <View style={styles.root} testID="offline-packs">
      <View style={[styles.header, { marginTop: insets.top }]}>
        <Tap
          testID="offline-back"
          accessibilityRole="button"
          accessibilityLabel={params.from === 'pill' ? t('shell.back') : t('play')}
          onPress={back}
          style={styles.back}
        >
          <ChevronLeft size={18} color={eos.ash} strokeWidth={1.8} />
          <AppText variant="bodyStrong" color={eos.ash}>
            {params.from === 'pill' ? t('shell.back') : t('play')}
          </AppText>
        </Tap>
        <View style={styles.flex} />
        {E2E ? <ForceOffline /> : null}
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: DOCK_H + insets.bottom }]}>
        <View>
          <AppText variant="heading" accessibilityRole="header">
            {t('offline.title')}
          </AppText>
          <AppText variant="body" color={eos.ash} style={styles.lede}>
            {t('offline.lede')}
          </AppText>
        </View>

        <HeroCard style={styles.hero}>
          <View style={styles.countRow}>
            <AppText variant="sectionTitle" style={styles.tabular} testID="offline-count">
              {String(total)}
            </AppText>
            <AppText variant="bodyStrong" color={eos.ash} style={styles.flex} numberOfLines={1}>
              {tn('offline.on_phone', total)}
            </AppText>
            <AppText variant="captionStrong" color={eos.dust} testID="offline-size">
              {formatSize(bytes, t)}
            </AppText>
          </View>
          <View style={styles.bar} accessible accessibilityRole="image" accessibilityLabel={t('offline.storage_a11y')}>
            {segments.map((r) => (
              <View key={r.key} style={{ flex: r.left, backgroundColor: PACK_SWATCH[r.key] }} />
            ))}
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{t('offline.top_up')}</AppText>
              <AppText variant="caption">{t('offline.top_up_hint', { n: TOP_UP_TARGET })}</AppText>
            </View>
            <Toggle
              testID="offline-topup"
              accessibilityLabel={t('offline.top_up')}
              value={topUpOn}
              onChange={(v) => {
                useOfflineStore.getState().setTopUp(v);
                if (v) void requestSync('manual');
              }}
            />
          </View>
        </HeroCard>

        {offline ? (
          <View style={styles.note} testID="offline-note">
            <WifiOff size={16} color={eos.ash} />
            <AppText variant="caption" style={styles.flex}>
              {t('offline.offline_note')}
            </AppText>
          </View>
        ) : null}

        {queue.length > 0 ? (
          <View style={styles.note} testID="offline-pending-card">
            <RefreshCw size={16} color={tone.amberLight} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" testID="offline-pending">
                {plural(tn, 'offline.waiting', queue.length)}
              </AppText>
              {sync === 'failed' || sync === 'unavailable' ? (
                <AppText variant="caption" color={tone.rose} testID={`offline-sync-${sync}`}>
                  {t(sync === 'failed' ? 'offline.sync_failed' : 'offline.sync_unavailable')}
                </AppText>
              ) : null}
            </View>
            {!offline ? (
              <MiniButton
                testID="offline-sync-now"
                label={sync === 'syncing' ? t('offline.syncing') : t('offline.sync_now')}
                busy={sync === 'syncing'}
                onPress={() => void requestSync('manual')}
              />
            ) : null}
          </View>
        ) : null}

        <View>
          <SectionLabel size="section">{t('offline.packs')}</SectionLabel>
          <View style={styles.list}>
            {rows.map((r, i) => (
              <PackRow
                key={r.key}
                k={r.key}
                first={i === 0}
                title={packTitle(r.key, t)}
                meta={packMeta(r.key, r.pack, r.left, r.bytes, { t, tn, lang })}
                saved={!!r.pack && (r.key !== 'review' || r.left > 0)}
                left={r.left}
                download={r.key === 'review' ? undefined : downloads[r.key]}
                loading={r.key === 'review' ? reviewLoading : downloads[r.key]?.status === 'loading'}
                offline={offline}
                onOpen={() => open(r.key)}
                onAction={() => {
                  if (r.key === 'review') return;
                  const d = downloads[r.key];
                  if (d?.status === 'loading') cancelDownload(r.key);
                  else if (r.pack) setRemoving(r.key);
                  else void downloadPack(r.key);
                }}
              />
            ))}
          </View>
          {total > 0 ? (
            <AppText variant="caption" color={eos.dust} style={styles.tapHint}>
              {t('offline.tap_hint')}
            </AppText>
          ) : null}
        </View>

      </ScrollView>

      <View style={[styles.dock, { paddingBottom: Math.max(space[6], insets.bottom) }]} pointerEvents="box-none">
        <PlateButton
          testID="offline-flight"
          label={t('offline.flight', { n: FLIGHT_PACK_COUNT })}
          accessibilityLabel={t('offline.flight_a11y', { n: FLIGHT_PACK_COUNT })}
          icon={<Plane size={18} color={tone.plateInk} strokeWidth={1.8} />}
          size="lg"
          block
          disabled={offline}
          loading={downloads.level?.status === 'loading'}
          onPress={() => void downloadPack('level', { count: FLIGHT_PACK_COUNT })}
        />
      </View>

      <Sheet visible={removing !== null} onClose={() => setRemoving(null)} testID="offline-remove-sheet" closeLabel={t('offline.cancel')}>
        <AppText variant="title">{t('offline.remove_title', { name: removing ? packTitle(removing, t) : '' })}</AppText>
        <AppText variant="body" color={eos.ash}>
          {t('offline.remove_body')}
        </AppText>
        <View style={styles.sheetButtons}>
          <DangerButton
            testID="offline-remove-confirm"
            label={t('offline.remove')}
            filled
            onPress={() => {
              if (removing) useOfflineStore.getState().removePack(removing);
              setRemoving(null);
            }}
          />
          <PlateButton testID="offline-remove-cancel" label={t('offline.cancel')} variant="slate" block onPress={() => setRemoving(null)} />
        </View>
      </Sheet>
    </View>
  );
}

function PackRow({
  k,
  first,
  title,
  meta,
  saved,
  left,
  download,
  loading,
  offline,
  onOpen,
  onAction,
}: {
  k: PackKey;
  first: boolean;
  title: string;
  meta: string;
  saved: boolean;
  left: number;
  download: DownloadState | undefined;
  loading: boolean;
  offline: boolean;
  onOpen: () => void;
  onAction: () => void;
}) {
  const t = useT();
  const auto = k === 'review';
  const failed = download?.status === 'error' || download?.status === 'unavailable' || download?.status === 'offline';
  const note =
    download?.status === 'error'
      ? t('offline.err_download')
      : download?.status === 'unavailable'
        ? t('offline.err_unavailable')
        : download?.status === 'offline'
          ? t('offline.err_offline')
          : auto && !saved && !loading
            ? t('offline.review_empty')
            : null;
  const canOpen = saved && left > 0 && !loading;
  const swatch = saved || loading ? PACK_SWATCH[k] : SWATCH_EMPTY;

  const body = (
    <>
      <View style={[styles.swatch, { backgroundColor: swatch }]} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" numberOfLines={1} style={styles.meta} testID={`offline-pack-${k}-meta`}>
          {meta}
        </AppText>
        {note ? (
          <AppText variant="caption" color={failed ? tone.rose : eos.dust} numberOfLines={2} testID={`offline-pack-${k}-note`}>
            {note}
          </AppText>
        ) : null}
        {loading && !auto ? <CreepBar /> : null}
      </View>
    </>
  );

  return (
    <View style={[styles.row, !first && styles.rowSeam]} testID={`offline-pack-${k}`}>
      {canOpen ? (
        <Tap
          testID={`offline-pack-${k}-open`}
          accessibilityRole="button"
          accessibilityLabel={t('offline.open_a11y', { name: title })}
          onPress={onOpen}
          style={styles.rowBody}
        >
          {body}
        </Tap>
      ) : (
        <View style={styles.rowBody}>{body}</View>
      )}
      {auto ? (
        <View style={styles.action} accessible accessibilityLabel={t('offline.auto_a11y', { name: title })} testID={`offline-pack-${k}-state`}>
          {loading ? (
            <ActivityIndicator size="small" color={eos.ash} />
          ) : (
            <>
              <RefreshCw size={14} color={eos.dust} strokeWidth={2} />
              <AppText variant="captionStrong" color={eos.dust}>
                {t('offline.auto_badge')}
              </AppText>
            </>
          )}
        </View>
      ) : (
        <Tap
          testID={`offline-pack-${k}-action`}
          accessibilityRole="button"
          accessibilityLabel={
            loading ? t('offline.loading_a11y', { name: title }) : saved ? t('offline.saved_a11y', { name: title }) : t('offline.get_a11y', { name: title })
          }
          accessibilityState={{ disabled: !saved && !loading && offline }}
          disabled={!saved && !loading && offline}
          onPress={onAction}
          hitSlop={{ top: 4, bottom: 4 }}
          style={[styles.action, !saved && !loading && styles.actionGet, !saved && !loading && offline && styles.dim]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={eos.bone} />
          ) : saved ? (
            <Check size={16} color={tone.sage} strokeWidth={2} />
          ) : (
            <Download size={16} color={eos.bone} strokeWidth={2} />
          )}
          <AppText variant="captionStrong" color={saved && !loading ? tone.sage : eos.bone} testID={`offline-pack-${k}-state`}>
            {loading ? '' : saved ? t('offline.saved') : t('offline.get')}
          </AppText>
        </Tap>
      )}
    </View>
  );
}

/** Eased stand-in for download progress (one JSON response, no progress events). */
function CreepBar() {
  const p = useSharedValue(0.04);
  useEffect(() => {
    p.set(withTiming(DOWNLOAD_CREEP, downloadCreepTiming));
  }, [p]);
  const fill = useAnimatedStyle(() => ({ width: `${p.get() * 100}%` }));
  return (
    <View style={styles.creepTrack}>
      <Animated.View style={[styles.creepFill, fill]} />
    </View>
  );
}

/** E2E builds: a switch standing in for airplane mode (simulators can't cut the network). */
function ForceOffline() {
  const forced = useShellStore((s) => s.forceOffline);
  return (
    <Tap
      testID="e2e-force-offline"
      accessibilityRole="switch"
      accessibilityLabel="e2e force offline"
      accessibilityState={{ checked: forced }}
      onPress={() => useShellStore.getState().setForceOffline(!forced)}
      style={styles.e2e}
    >
      <AppText variant="caption" color={eos.dust}>
        {forced ? 'e2e: offline' : 'e2e: online'}
      </AppText>
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center' },
  back: { height: layout.headerButton, paddingHorizontal: space[3], flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  scroll: { paddingHorizontal: layout.gutter, gap: space[4] },
  lede: { marginTop: space[1.5] },
  hero: { padding: space[4] },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  bar: { marginTop: space[2.5], height: 6, borderRadius: radii.full, backgroundColor: eos.well, flexDirection: 'row', overflow: 'hidden' },
  toggleRow: { marginTop: space[3.5], flexDirection: 'row', alignItems: 'center', gap: space[3] },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3.5],
    paddingVertical: space[3],
    borderRadius: radii.xl,
    backgroundColor: eos.shade,
    borderWidth: 1,
    borderColor: eos.seam,
  },
  list: { marginTop: space[2], borderRadius: radii.cardComponent, backgroundColor: eos.slate, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: space[3.5] },
  rowSeam: { borderTopWidth: 1, borderTopColor: eos.rise },
  rowBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingLeft: space[3.5], paddingRight: space[3] },
  swatch: { width: 10, height: 36, borderRadius: 3 },
  meta: { marginTop: space[0.5] },
  action: {
    minWidth: space[11],
    height: space[9],
    paddingHorizontal: space[2.5],
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1.5],
  },
  actionGet: { backgroundColor: eos.rise },
  dim: { opacity: 0.5 },
  creepTrack: { marginTop: space[1.5], height: 4, borderRadius: radii.full, backgroundColor: eos.well, overflow: 'hidden' },
  creepFill: { height: 4, borderRadius: radii.full, backgroundColor: tone.copper },
  tapHint: { marginTop: space[2], paddingHorizontal: space[1] },
  dock: { position: 'absolute', left: layout.gutter, right: layout.gutter, bottom: 0 },
  sheetButtons: { gap: space[3], marginTop: space[2] },
  e2e: { alignSelf: 'flex-start', height: space[11], justifyContent: 'center', paddingHorizontal: space[2] },
});

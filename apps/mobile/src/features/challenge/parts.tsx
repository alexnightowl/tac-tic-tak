import type { StormFormat, StormResult } from '@tac/core/storm';
import { alpha, eos, radii, space, tone } from '@tac/core/tokens';
import { Clock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Avatar } from '@/features/profile/Avatar';
import { plural } from '@/features/offline/format';
import { useAppStore } from '@/stores/appStore';
import { AppText } from '@/ui';
import type { TFn, TnFn } from '@/ui/lang';

/** Strip cell colours (ChallengeResult): sage solved, ember mistake. */
export const CELL_OK = tone.sageDeep;
export const CELL_MISS = eos.ember;

/** My rating as the server counts it for a Race: the highest style rating. */
export function useMyRating(): number {
  return useAppStore((s) => Math.max(...Object.values(s.progressions).map((p) => p.currentPuzzleRating)));
}

/** m:ss of a duration. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** hh:mm:ss until `to`. */
function hms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** "3:00" / "5:00" for the timed formats (the "solved in" line). */
export const formatClock = (f: StormFormat) => (f === 'time5' ? '5:00' : '3:00');

/** "14 solved in 3:00" / "16 solved before 3 mistakes". */
export function playedLine(tn: TnFn, format: StormFormat, score: number): string {
  return format === 'survival'
    ? plural(tn, 'challenge.played.survival', score)
    : plural(tn, 'challenge.played.timed', score, { clock: formatClock(format) });
}

/** "21 h" / "40 min" left until `iso` (the Rivals rows). */
export function leftShort(t: TFn, iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const h = Math.floor(ms / 3600_000);
  return h >= 1 ? t('challenge.left_h', { n: h }) : t('challenge.left_m', { n: Math.max(1, Math.ceil(ms / 60_000)) });
}

/**
 * "Expires in hh:mm:ss · doesn't affect rating": a self-contained 1 Hz
 * ticker (only this text re-renders). `onExpire` fires once at zero.
 */
export function ExpiryCountdown({
  expiresAt,
  t,
  onExpire,
  testID,
}: {
  expiresAt: string;
  t: TFn;
  onExpire?: () => void;
  testID: string;
}) {
  const end = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let fired = false;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      if (at >= end) {
        if (!fired) {
          fired = true;
          onExpire?.();
        }
        return;
      }
      // Align to the next whole second of the remaining time.
      timer = setTimeout(tick, ((end - at) % 1000) + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, [end, onExpire]);
  const text = t('challenge.expires', { time: hms(end - now) });
  return (
    <View style={styles.expiry} testID={testID} accessible accessibilityLabel={text}>
      <Clock size={14} strokeWidth={1.8} color={eos.ash} />
      <AppText variant="captionStrong" color={eos.ash} style={styles.tabular}>
        {text}
      </AppText>
    </View>
  );
}

/** Avatar with the green "active in the last 2 minutes" dot. */
export function PresenceAvatar({
  nickname,
  avatarUrl,
  size,
  online,
  ring,
}: {
  nickname: string;
  avatarUrl: string | null;
  size: number;
  online?: boolean;
  /** Ember (selected) or sage (winner) ring 2 pt off the disc. */
  ring?: string;
}) {
  return (
    <View style={{ width: size, height: size }}>
      {ring ? <View pointerEvents="none" style={[styles.ring, { borderRadius: size, borderColor: ring }]} /> : null}
      <Avatar nickname={nickname} avatarUrl={avatarUrl} size={size} />
      {online ? <View style={[styles.dot, { right: size > 60 ? 4 : 1, bottom: size > 60 ? 4 : 1 }]} /> : null}
    </View>
  );
}

/** One run as squares: sage solved, ember mistake (ChallengeResult strips). */
export function RunStrip({
  results,
  label,
  testID,
  style,
}: {
  results: readonly StormResult[];
  label: string;
  testID: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.strip, style]} accessible accessibilityRole="image" accessibilityLabel={label} testID={testID}>
      {results.map((r) => (
        <View key={r.i} style={[styles.cell, { backgroundColor: r.ok ? CELL_OK : CELL_MISS }]} />
      ))}
    </View>
  );
}

/** Strip legend: Solved / Mistake. */
export function StripLegend({ t }: { t: TFn }) {
  return (
    <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {[
        [CELL_OK, t('challenge.solved')],
        [CELL_MISS, t('challenge.mistake')],
      ].map(([c, l]) => (
        <View key={l} style={styles.legendItem}>
          <View style={[styles.legendCell, { backgroundColor: c }]} />
          <AppText variant="captionStrong" color={eos.ash}>
            {l}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Small result chip (Rivals rows): W sage, L rose, D ash, New ember. */
export function OutcomeChip({ label, kind }: { label: string; kind: 'win' | 'loss' | 'draw' | 'new' | 'muted' }) {
  const c =
    kind === 'win'
      ? { bg: alpha(tone.sageDeep, 0.16), fg: tone.sage }
      : kind === 'loss'
        ? { bg: alpha(eos.ember, 0.16), fg: tone.rose }
        : kind === 'new'
          ? { bg: eos.ember, fg: tone.onEmber }
          : { bg: eos.rise, fg: eos.ash };
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <AppText variant="captionStrong" color={c.fg} maxFontSizeMultiplier={1.2}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
  expiry: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ring: { position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderWidth: 2 },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: radii.full,
    backgroundColor: tone.sageDeep,
    borderWidth: 2,
    borderColor: eos.ink,
  },
  strip: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  cell: { width: 12, height: 12, borderRadius: 2 },
  legend: { flexDirection: 'row', gap: 14, marginTop: space[2.5] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
  chip: { minWidth: 28, height: 22, paddingHorizontal: space[2], borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
});

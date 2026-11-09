import { control, eos, radii, space } from '@tac/core/tokens';
import { EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { plural } from '@/features/offline/format';
import { AppText } from '@/ui';
import { useT, useTn, type TFn, type TnFn } from '@/ui/lang';
import { blindSessionOf, type BlindSession } from './store';

/** "Blind · peeked 3 times" (or "no peeks"), for a session started blind on this device. */
export function blindPeeksLine(b: BlindSession, t: TFn, tn: TnFn): string {
  return b.peeks > 0 ? plural(tn, 'blind.summary.peeks', b.peeks) : t('blind.summary.no_peeks');
}

/** The blind session's line on the phone summary; nothing for other sessions. */
export function BlindSummaryLine({ sessionId }: { sessionId: string }) {
  const t = useT();
  const tn = useTn();
  const [b] = useState(() => blindSessionOf(sessionId));
  if (!b) return null;
  return (
    <View style={styles.row} testID="summary-blind">
      <EyeOff size={16} color={eos.ember} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{blindPeeksLine(b, t, tn)}</AppText>
        <AppText variant="caption" color={eos.ash}>
          {t('blind.summary.look', { n: b.previewSec })}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radii.xl,
    backgroundColor: control.emberTint16,
    borderWidth: 1,
    borderColor: control.dangerBorder,
  },
  flex: { flex: 1, minWidth: 0 },
});

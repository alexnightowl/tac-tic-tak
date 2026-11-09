import { alpha, eos, tone } from '@tac/core/tokens';
import { EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { blindPeeksLine } from '@/features/play/blind/BlindSummary';
import { blindSessionOf } from '@/features/play/blind/store';
import { useT, useTn } from '@/ui/lang';
import { DText } from '../kit';
import { dx } from '../tokens';

/** DxSessionSummary: the blind session's line ("Blind · peeked 3 times", the look time); nothing otherwise. */
export function DxBlindSummary({ sessionId }: { sessionId: string }) {
  const t = useT();
  const tn = useTn();
  const [b] = useState(() => blindSessionOf(sessionId));
  if (!b) return null;
  return (
    <View style={styles.row} testID="summary-blind">
      <EyeOff size={16} color={eos.ember} strokeWidth={1.8} />
      <View style={styles.flex}>
        <DText size={14} weight={800}>
          {blindPeeksLine(b, t, tn)}
        </DText>
        <DText size={12.5} color={dx.ash} style={styles.mt2}>
          {t('blind.summary.look', { n: b.previewSec })}
        </DText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt2: { marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: alpha(eos.ember, 0.1),
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(tone.emberGlow, 0.35), inset: true }],
  },
});

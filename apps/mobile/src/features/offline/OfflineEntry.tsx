import { OFFLINE_PACK_KINDS } from '@tac/core/offline';
import { tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Plane } from 'lucide-react-native';

import { CardRow, IconTile } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { plural } from './format';
import { unplayedOf, useOfflineStore, type PackKey } from './store';

const KEYS: readonly PackKey[] = [...OFFLINE_PACK_KINDS, 'review'];

/** Play tab row into Offline puzzles: what is on the phone and what waits to sync. */
export function OfflineEntry() {
  const t = useT();
  const tn = useTn();
  const onPhone = useOfflineStore((s) => KEYS.reduce((n, k) => n + unplayedOf(s, k).length, 0));
  const waiting = useOfflineStore((s) => s.queue.length);
  const parts = [
    onPhone > 0 ? `${onPhone} ${tn('offline.on_phone', onPhone)}` : t('offline.entry_hint'),
    waiting > 0 ? plural(tn, 'offline.waiting', waiting) : null,
  ];
  return (
    <CardRow
      testID="play-offline"
      title={t('offline.title')}
      subtitle={parts.filter(Boolean).join(' · ')}
      accessibilityLabel={t('offline.title')}
      leading={
        <IconTile size={40}>
          <Plane size={18} color={tone.amberLight} strokeWidth={1.8} />
        </IconTile>
      }
      onPress={() => router.push('/offline' as Href)}
    />
  );
}

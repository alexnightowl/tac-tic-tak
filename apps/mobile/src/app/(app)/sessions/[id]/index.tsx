import { useLocalSearchParams } from 'expo-router';

import { DxSessionDetail } from '@/desktop/rivals';
import { useDesktop } from '@/desktop/useDesktop';
import { SessionDetailScreen } from '@/features/sessions/SessionDetailScreen';

// /sessions/[id]: session detail (push); a desktop window gets the DX page.
export default function SessionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const desktop = useDesktop();
  return desktop ? <DxSessionDetail key={id} id={id} /> : <SessionDetailScreen key={id} id={id} />;
}

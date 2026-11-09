import { DxSessions } from '@/desktop/rivals';
import { useDesktop } from '@/desktop/useDesktop';
import { HistoryScreen } from '@/features/sessions/HistoryScreen';

// /sessions: session history (push); a desktop window gets the DX page.
export default function SessionsRoute() {
  const desktop = useDesktop();
  return desktop ? <DxSessions /> : <HistoryScreen />;
}

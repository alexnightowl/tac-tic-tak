import { useDesktop } from '@/desktop/useDesktop';
import { DxPlay } from '@/desktop/home';
import { PlaySetupScreen } from '@/features/play/setup/PlaySetupScreen';

// Play tab = the setup screen (PLAN §2.3); the runner is the full-screen
// stack route play/[id] above the tabs. A desktop window gets DXPlay*.
export default function PlayTab() {
  const desktop = useDesktop();
  return desktop ? <DxPlay /> : <PlaySetupScreen />;
}

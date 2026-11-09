import { DxHome } from '@/desktop/home';
import { useDesktop } from '@/desktop/useDesktop';
import { HomeScreen } from '@/features/home/HomeScreen';

// Home tab (PLAN §2.3; path "/"). Keeps the home-* / open-dev testIDs the
// 02-* and 04-* Maestro flows use. A desktop window gets DXHome.
export default function HomeTab() {
  const desktop = useDesktop();
  return desktop ? <DxHome /> : <HomeScreen />;
}

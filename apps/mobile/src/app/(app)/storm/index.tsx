import { DxStormIntro } from '@/desktop/home';
import { useDesktop } from '@/desktop/useDesktop';
import { StartScreen } from '@/features/storm/StartScreen';

// /storm: Puzzle Storm start (push, no header: the screen draws its back link).
// A desktop window gets DXStormIntro.
export default function StormStartRoute() {
  const desktop = useDesktop();
  return desktop ? <DxStormIntro /> : <StartScreen />;
}

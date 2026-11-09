import { router, type Href } from 'expo-router';

import { DxPlay } from '@/desktop/home';
import { useDesktop } from '@/desktop/useDesktop';
import { LevelSheet } from '@/features/play/setup/LevelSheet';

// fullScreenModal (presentation in (app)/_layout): "How your level works",
// opened from the rated card on the play setup. On a desktop window the
// Play page shows it as its right panel (DXLevelsInfo); closing it leaves
// this route.
export default function LevelsRoute() {
  const desktop = useDesktop();
  if (!desktop) return <LevelSheet />;
  return <DxPlay levelsOpen onLevelsClose={() => (router.canGoBack() ? router.back() : router.replace('/play' as Href))} />;
}

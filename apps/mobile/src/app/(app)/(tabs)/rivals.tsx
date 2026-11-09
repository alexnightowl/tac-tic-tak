import { DxLeague } from '@/desktop/rivals';
import { useDesktop } from '@/desktop/useDesktop';
import { RivalsScreen } from '@/features/social/RivalsScreen';

// Rivals tab = the leaderboard (the canvas tab bar, web /leaderboard); a
// desktop window gets DXLeague.
export default function RivalsRoute() {
  const desktop = useDesktop();
  return desktop ? <DxLeague /> : <RivalsScreen />;
}

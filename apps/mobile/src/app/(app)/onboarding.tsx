import { DxOnboarding } from '@/desktop/auth';
import { useDesktop } from '@/desktop/useDesktop';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

// Welcome slides (fullScreenModal, gestureEnabled false; opened by the
// onboarding gate or Settings → App → Replay onboarding). A desktop-wide
// browser window gets the DXOnb1–4 layout.
export default function Onboarding() {
  const desktop = useDesktop();
  return desktop ? <DxOnboarding /> : <OnboardingScreen />;
}

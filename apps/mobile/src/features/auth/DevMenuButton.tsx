import { eos, space } from '@tac/core/tokens';
import { router } from 'expo-router';
import { Terminal } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEV_MENU } from '@/dev/flags';
import { Tap } from '@/ui/Tap';
import { useAuthT } from './strings';

/**
 * Dev builds only: a dim glyph pinned to the bottom of the login / register
 * screens that opens /dev while signed out (signed in, the account menu has
 * the same entry). Absolutely positioned so the centred form sits exactly
 * where MobLogin / MobRegister put it.
 * Maestro's common/open-dev.yaml taps it by testID `open-dev`. Release
 * builds render nothing.
 */
export function DevMenuButton() {
  const t = useAuthT();
  const insets = useSafeAreaInsets();
  if (!DEV_MENU) return null;
  return (
    <Tap
      testID="open-dev"
      accessibilityRole="button"
      accessibilityLabel={t('dev.open')}
      onPress={() => router.push('/dev')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.dev, { bottom: insets.bottom }]}
    >
      <Terminal size={16} color={eos.dust} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  dev: { position: 'absolute', alignSelf: 'center', padding: space[3], opacity: 0.6 },
});

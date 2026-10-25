import { eos, space } from '@tac/core/tokens';
import { router } from 'expo-router';
import { Terminal } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { DEV_MENU } from '@/dev/flags';
import { Tap } from '@/ui/Tap';
import { useAuthT } from './strings';

/**
 * Dev builds only: a dim glyph under the login / register forms that opens
 * /dev while signed out (signed in, the account menu has the same entry).
 * Maestro's common/open-dev.yaml taps it by testID `open-dev`. Release
 * builds render nothing.
 */
export function DevMenuButton() {
  const t = useAuthT();
  if (!DEV_MENU) return null;
  return (
    <Tap
      testID="open-dev"
      accessibilityRole="button"
      accessibilityLabel={t('dev.open')}
      onPress={() => router.push('/dev')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.dev}
    >
      <Terminal size={16} color={eos.dust} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  dev: { alignSelf: 'center', padding: space[3], opacity: 0.6 },
});

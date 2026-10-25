import { eos, radii, space } from '@tac/core/tokens';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { DEV_MENU } from '@/dev/flags';
import { AppText } from '@/ui';
import { Tap } from '@/ui/Tap';
import { useAuthT } from './strings';

/**
 * Dev-build entry to /dev. Maestro's common/open-dev.yaml expects testID
 * `open-dev` on the first screen after launch, so both login and Home
 * render it.
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
      style={styles.dev}
    >
      <AppText variant="caption">{t('dev.open')}</AppText>
    </Tap>
  );
}

const styles = StyleSheet.create({
  dev: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: eos.seam,
  },
});

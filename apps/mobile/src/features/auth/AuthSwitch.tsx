import { eos, space } from '@tac/core/tokens';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui';
import { Tap } from '@/ui/Tap';

/** "No account? Sign up" / "Already registered? Log in" row under the auth forms. */
export function AuthSwitch({ prompt, action, to, testID }: { prompt: string; action: string; to: '/login' | '/register'; testID: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="body" color={eos.ash}>
        {prompt}
      </AppText>
      <Tap
        testID={testID}
        accessibilityLabel={action}
        accessibilityRole="link"
        onPress={() => router.replace(to)}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      >
        <AppText variant="body" color={eos.bone} style={styles.action}>
          {action}
        </AppText>
      </Tap>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space[2] },
  action: { textDecorationLine: 'underline' },
});

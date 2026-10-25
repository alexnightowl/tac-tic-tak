import { eos, layout, space } from '@tac/core/tokens';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/ui/AppText';
import { useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';

/** +not-found: the web had none (Next's default 404). */
export function NotFoundScreen() {
  const t = useT();
  return (
    <SafeAreaView style={styles.root} testID="not-found-screen">
      <View style={styles.body}>
        <AppText variant="eyebrow">{t('shell.not_found.title')}</AppText>
        <AppText variant="title" accessibilityRole="header" style={styles.center}>
          {t('shell.not_found.body')}
        </AppText>
        <PlateButton
          testID="not-found-home"
          label={t('shell.go_home')}
          onPress={() => router.replace('/')}
          block
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space[4], paddingHorizontal: layout.gutter },
  center: { textAlign: 'center' },
});

import { eos, layout, space } from '@tac/core/tokens';
import { router, type ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/stores/appStore';
import { AppText } from '@/ui/AppText';
import { LangProvider, useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';

/**
 * Route error boundary UI (expo-router `export { ErrorBoundary }`). The root
 * layout's boundary replaces the providers, so this re-provides the
 * language from appStore and a gesture root: the plates are RNGH taps, and
 * a GestureDetector without a GestureHandlerRootView throws in dev (dead
 * buttons in release). `retry` re-renders the failed route.
 */
export function ShellErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const lang = useAppStore((s) => s.settings.language);
  return (
    <GestureHandlerRootView style={styles.root}>
      <LangProvider lang={lang}>
        <ErrorBody error={error} retry={retry} />
      </LangProvider>
    </GestureHandlerRootView>
  );
}

function ErrorBody({ error, retry }: ErrorBoundaryProps) {
  const t = useT();
  return (
    <SafeAreaView style={styles.root} testID="error-screen">
      <View style={styles.body}>
        <AppText variant="eyebrow">{t('shell.error.title')}</AppText>
        <AppText variant="title" accessibilityRole="header" style={styles.center}>
          {t('shell.error.body')}
        </AppText>
        {__DEV__ ? (
          <AppText variant="caption" style={styles.center} numberOfLines={4} testID="error-message">
            {error.message}
          </AppText>
        ) : null}
        <PlateButton testID="error-retry" label={t('shell.error.retry')} onPress={() => void retry()} block />
        <PlateButton
          testID="error-home"
          label={t('shell.go_home')}
          variant="slate"
          onPress={() => (router.canDismiss() ? router.dismissTo('/') : router.replace('/'))}
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

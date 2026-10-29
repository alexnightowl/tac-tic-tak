import { eos, layout, space } from '@tac/core/tokens';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from 'react-native';

import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { feel } from '@/feel';
import { AppText, BrandLogo, Card, Input, PasswordInput, PlateButton } from '@/ui';
import { AuthSwitch } from './AuthSwitch';
import { DevMenuButton } from './DevMenuButton';
import { login } from './session';
import { loginErrorKey, useAuthT } from './strings';
import { useShake } from './useShake';

type TextInputHandle = ComponentRef<typeof TextInput>;

/**
 * Minimal Phase 2 login (inventory "Login screen"). The welcome pager and
 * the refresh-token flow arrive in Phase 4. On success the auth guard
 * swaps the stack to (app); this screen never navigates itself.
 */
export function LoginScreen() {
  const t = useAuthT();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInputHandle>(null);
  // React 19 passes `ref` as a plain prop and Input spreads its rest props
  // onto the TextInput, so this reaches it; InputProps just doesn't declare
  // `ref` yet (reported to the src/ui owner).
  const passwordRefProp = { ref: passwordRef } as object;
  const { style: shakeStyle, shake } = useShake();

  const fail = (key: string) => {
    setError(t(key));
    feel.emit('formError');
    shake();
  };

  const submit = async () => {
    if (loading) return;
    if (!nickname || !password) {
      fail('auth.err_required');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(nickname, password);
    } catch (e) {
      fail(loginErrorKey(e));
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="login-screen">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand} testID="login-brand">
            <BrandLogo size={128} />
            {/* The wordmark is Latin in both languages: always Cinzel. */}
            <AppText variant="sectionTitle" lang="en" style={styles.center} accessibilityRole="header">
              {t('brand.name')}
            </AppText>
            <AppText variant="body" color={eos.ash} style={styles.center}>
              {t('auth.login')}
            </AppText>
          </View>
          <Animated.View style={shakeStyle}>
            <Card style={styles.form}>
              <Input
                testID="login-nickname"
                accessibilityLabel={t('auth.nickname')}
                label={t('auth.nickname')}
                value={nickname}
                onChangeText={(v) => {
                  setNickname(v);
                  if (error) setError(null);
                }}
                textContentType="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!loading}
              />
              <PasswordInput
                {...passwordRefProp}
                testID="login-password"
                accessibilityLabel={t('auth.password')}
                label={t('auth.password')}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (error) setError(null);
                }}
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                error={error}
                editable={!loading}
              />
              <PlateButton
                testID="login-submit"
                label={loading ? t('auth.logging_in') : t('auth.login')}
                accessibilityLabel={t('auth.login')}
                onPress={() => void submit()}
                // MobLogin "loading": the plate keeps its look and reads
                // "Logging in…" (no spinner); submit() ignores repeat taps.
                size="lg"
                block
              />
            </Card>
          </Animated.View>
          <AuthSwitch prompt={t('auth.no_account')} action={t('auth.create_account')} to="/register" testID="login-to-register" />
        </ScrollView>
      </KeyboardAvoidingView>
      <DevMenuButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
    paddingVertical: space[8],
    gap: space[6],
  },
  brand: { alignItems: 'center', gap: space[2] },
  center: { textAlign: 'center' },
  form: { gap: space[4] },
});

import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useLoginForm } from '@/features/auth/useLoginForm';
import { PlateButton } from '@/ui/PlateButton';
import { useHotkeys } from '../hotkeys';
import { AuthSplit, SwitchLink } from './AuthSplit';
import { Field } from './Field';

/**
 * DXLogin: the split screen with the app's login form (useLoginForm: same
 * validation, errors, testIDs as the phone screen). No "Remember me" /
 * "Forgot password?": the app has neither (the session always persists,
 * and there is no reset flow).
 */
export function DxLogin() {
  const { t, nickname, setNickname, password, setPassword, error, loading, submit, passwordRef, shakeStyle } = useLoginForm();
  // Enter outside the fields (the fields submit through onSubmitEditing).
  useHotkeys({ Enter: () => void submit() });
  return (
    <AuthSplit testID="login-screen" title={t('dx.auth.login_title')} subtitle={t('dx.auth.login_sub')} enterHint={t('dx.auth.login_enter')}>
      <Animated.View style={[styles.fields, shakeStyle]}>
        <Field
          testID="login-nickname"
          label={t('auth.nickname')}
          value={nickname}
          onChangeText={setNickname}
          textContentType="username"
          autoComplete="username"
          autoFocus
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!loading}
        />
        <Field
          ref={passwordRef}
          testID="login-password"
          label={t('auth.password')}
          secret
          value={password}
          onChangeText={setPassword}
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          error={error}
          editable={!loading}
        />
      </Animated.View>
      <View style={styles.plate}>
        <PlateButton
          testID="login-submit"
          label={loading ? t('auth.logging_in') : t('auth.login')}
          accessibilityLabel={t('auth.login')}
          onPress={() => void submit()}
          size="lg"
          block
        />
      </View>
      <SwitchLink prompt={t('auth.no_account')} action={t('auth.create_account')} to="/register" testID="login-to-register" />
    </AuthSplit>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 18, marginTop: 30 },
  plate: { marginTop: 28 },
});

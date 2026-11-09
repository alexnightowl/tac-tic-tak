import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useRegisterForm } from '@/features/auth/useRegisterForm';
import { PlateButton } from '@/ui/PlateButton';
import { useHotkeys } from '../hotkeys';
import { AuthSplit, RuleChecks, SwitchLink } from './AuthSplit';
import { Field } from './Field';

/**
 * DXRegister: nickname, password, repeat, with the app's live rules
 * (useRegisterForm, @tac/core/validation) as check rows under each field:
 * nickname rules, then the password's length / letter / digit, then
 * "passwords match" under the repeat. Submit stays disabled until all pass.
 */
export function DxRegister() {
  const { t, nickname, setNickname, password, setPassword, repeat, setRepeat, nickRows, pwRows, valid, error, loading, submit, passwordRef, repeatRef, shakeStyle } =
    useRegisterForm();
  const pwRules = pwRows.filter((r) => r.id !== 'match');
  const matchRule = pwRows.filter((r) => r.id === 'match');
  useHotkeys({ Enter: () => void submit() });
  return (
    <AuthSplit
      testID="register-screen"
      title={t('dx.auth.register_title')}
      subtitle={t('dx.auth.register_sub')}
      enterHint={t('dx.auth.register_enter')}
    >
      <Animated.View style={[styles.fields, shakeStyle]}>
        <Field
          testID="register-nickname"
          label={t('auth.nickname')}
          value={nickname}
          onChangeText={setNickname}
          textContentType="username"
          autoComplete="username-new"
          autoFocus
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!loading}
        />
        <RuleChecks rows={nickRows} t={t} testID="register-nick-rules" />
        <Field
          ref={passwordRef}
          testID="register-password"
          label={t('auth.password')}
          secret
          value={password}
          onChangeText={setPassword}
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => repeatRef.current?.focus()}
          editable={!loading}
        />
        <RuleChecks rows={pwRules} t={t} testID="register-pw-rules" />
        <Field
          ref={repeatRef}
          testID="register-repeat"
          label={t('auth.repeat')}
          placeholder={t('dx.auth.repeat_placeholder')}
          secret
          value={repeat}
          onChangeText={setRepeat}
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          error={error}
          editable={!loading}
        />
        <RuleChecks rows={matchRule} t={t} testID="register-match-rule" rowPrefix="register-pw-rules" />
      </Animated.View>
      <View style={styles.plate}>
        <PlateButton
          testID="register-submit"
          label={loading ? t('auth.creating') : t('auth.register')}
          accessibilityLabel={t('auth.register')}
          onPress={() => void submit()}
          disabled={!valid}
          size="lg"
          block
        />
      </View>
      <SwitchLink prompt={t('auth.have_account')} action={t('auth.login')} to="/login" testID="register-to-login" />
    </AuthSplit>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 18, marginTop: 30 },
  plate: { marginTop: 28 },
});

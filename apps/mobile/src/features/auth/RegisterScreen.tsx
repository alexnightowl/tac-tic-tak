import { nicknameRules, passwordRules, registerFormValid, type RuleRow } from '@tac/core/validation';
import { eos, layout, space } from '@tac/core/tokens';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { feel } from '@/feel';
import { AppText, BrandLogo, Card, Input, PasswordInput, PlateButton, useLang } from '@/ui';
import { AuthSwitch } from './AuthSwitch';
import { DevMenuButton } from './DevMenuButton';
import { register } from './session';
import { loginErrorKey, useAuthT } from './strings';
import { useShake } from './useShake';

type TextInputHandle = ComponentRef<typeof TextInput>;

/**
 * Register (web /register): nickname + password + repeat with the live rule
 * checklist from @tac/core/validation; submit stays disabled until every
 * rule is met, like the web. Success signs in and the guard swaps to (app).
 */
export function RegisterScreen() {
  const t = useAuthT();
  const { lang } = useLang();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInputHandle>(null);
  const repeatRef = useRef<TextInputHandle>(null);
  const { style: shakeStyle, shake } = useShake();

  const nickRows = nicknameRules(nickname);
  const pwRows: RuleRow<string>[] = [
    ...passwordRules(password),
    { id: 'match', met: repeat.length > 0 && repeat === password, labelKey: 'auth.rule_pw_match' },
  ];
  const valid = registerFormValid({ nickname, password, repeat });

  // One light tick each time another rule turns green (PLAN Phase 4).
  const metCount = [...nickRows, ...pwRows].filter((r) => r.met && (r.id !== 'chars' && r.id !== 'doubles' || nickname.length > 0)).length;
  const lastMet = useRef(metCount);
  useEffect(() => {
    if (metCount > lastMet.current) feel.emit('toggle');
    lastMet.current = metCount;
  }, [metCount]);

  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (error) setError(null);
  };

  const submit = async () => {
    if (loading || !valid) return;
    setError(null);
    setLoading(true);
    try {
      await register(nickname, password, repeat, lang);
    } catch (e) {
      setError(t(loginErrorKey(e)));
      feel.emit('formError');
      shake();
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="register-screen">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <BrandLogo size={96} />
            {/* The wordmark is Latin in both languages: always Cinzel. */}
            <AppText variant="sectionTitle" lang="en" style={styles.center} accessibilityRole="header">
              {t('brand.name')}
            </AppText>
            <AppText variant="body" color={eos.ash} style={styles.center}>
              {t('auth.create_account')}
            </AppText>
          </View>
          <Animated.View style={shakeStyle}>
            <Card style={styles.form}>
              <Input
                testID="register-nickname"
                accessibilityLabel={t('auth.nickname')}
                label={t('auth.nickname')}
                value={nickname}
                onChangeText={edit(setNickname)}
                textContentType="username"
                autoComplete="username-new"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!loading}
              />
              <Rules rows={nickRows} t={t} testID="register-nick-rules" />
              <PasswordInput
                {...({ ref: passwordRef } as object)}
                testID="register-password"
                accessibilityLabel={t('auth.password')}
                label={t('auth.password')}
                value={password}
                onChangeText={edit(setPassword)}
                kind="new"
                returnKeyType="next"
                onSubmitEditing={() => repeatRef.current?.focus()}
                editable={!loading}
              />
              <PasswordInput
                {...({ ref: repeatRef } as object)}
                testID="register-repeat"
                accessibilityLabel={t('auth.repeat')}
                label={t('auth.repeat')}
                value={repeat}
                onChangeText={edit(setRepeat)}
                kind="new"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                error={error}
                editable={!loading}
              />
              <Rules rows={pwRows} t={t} testID="register-pw-rules" />
              <PlateButton
                testID="register-submit"
                label={loading ? t('auth.creating') : t('auth.register')}
                accessibilityLabel={t('auth.register')}
                onPress={() => void submit()}
                // Like MobLogin "loading": the label changes, no spinner.
                disabled={!valid}
                size="lg"
                block
              />
            </Card>
          </Animated.View>
          <AuthSwitch prompt={t('auth.have_account')} action={t('auth.login')} to="/login" testID="register-to-login" />
        </ScrollView>
      </KeyboardAvoidingView>
      <DevMenuButton />
    </SafeAreaView>
  );
}

// MobRegister's own glyphs (not Lucide's check / x).
const RULE_MET = 'M5 12l5 5 9-10';
const RULE_UNMET = 'M6 6l12 12M18 6L6 18';

function Rules({ rows, t, testID }: { rows: RuleRow<string>[]; t: (k: string) => string; testID: string }) {
  return (
    <View style={styles.rules} testID={testID}>
      {rows.map((r) => (
        <View key={r.id} style={styles.rule} testID={`${testID}-${r.id}-${r.met ? 'met' : 'unmet'}`}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d={r.met ? RULE_MET : RULE_UNMET}
              stroke={r.met ? eos.sage : eos.dust}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <AppText variant="caption" color={r.met ? eos.sage : eos.dust}>
            {t(r.labelKey)}
          </AppText>
        </View>
      ))}
    </View>
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
  form: { gap: space[3] },
  rules: { gap: space[1], marginTop: -space[1] },
  rule: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});

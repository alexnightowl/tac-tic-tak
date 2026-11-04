'use client';

import { nicknameRules, passwordRules, registerFormValid, type RuleRow } from '@tac/core/validation';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';

import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { AppText, Card, Input, PasswordInput, PlateButton } from '@/v2/ui';
import { AuthFrame, AuthSwitch, useShake } from './AuthFrame';
import { authErrorKey, register } from './session';

type Field = HTMLInputElement | HTMLTextAreaElement;

/** Enter on a field that is not the last moves focus on (the app's returnKeyType "next"). */
const next = (to: RefObject<Field>) => (e: KeyboardEvent<HTMLElement>) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  to.current?.focus();
};

/**
 * Register (app features/auth/RegisterScreen.tsx): nickname, password and
 * repeat with the live rule checklist from @tac/core/validation; submit
 * stays disabled until every rule is met. Success signs in and opens
 * /dashboard, as the web did.
 */
export function RegisterScreen() {
  const t = useT();
  const router = useRouter();
  const language = useAppStore((s) => s.settings.language);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<Field>(null);
  const repeatRef = useRef<Field>(null);
  const { ref: cardRef, shake } = useShake<HTMLDivElement>();

  const nickRows = nicknameRules(nickname);
  const pwRows: RuleRow<string>[] = [
    ...passwordRules(password),
    { id: 'match', met: repeat.length > 0 && repeat === password, labelKey: 'auth.rule_pw_match' },
  ];
  const valid = registerFormValid({ nickname, password, repeat });

  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (error) setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || !valid) return;
    setError(null);
    setLoading(true);
    try {
      await register(nickname, password, repeat, language);
      router.replace('/dashboard');
    } catch (err) {
      setError(t(authErrorKey(err)));
      shake();
      setLoading(false);
    }
  };

  return (
    <AuthFrame
      logo={96}
      subtitle={t('auth.create_account')}
      testID="register-screen"
      footer={<AuthSwitch prompt={t('auth.have_account')} action={t('auth.login')} href="/login" testID="register-to-login" />}
    >
      <form onSubmit={submit} noValidate>
        <div ref={cardRef}>
          <Card className="v2-auth-form v2-auth-form--tight">
            <Input
              testID="register-nickname"
              label={t('auth.nickname')}
              name="username"
              value={nickname}
              onChangeText={edit(setNickname)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              enterKeyHint="next"
              onKeyDown={next(passwordRef)}
              readOnly={loading}
            />
            <Rules rows={nickRows} testID="register-nick-rules" />
            <PasswordInput
              ref={passwordRef}
              testID="register-password"
              label={t('auth.password')}
              name="new-password"
              value={password}
              onChangeText={edit(setPassword)}
              kind="new"
              enterKeyHint="next"
              onKeyDown={next(repeatRef)}
              readOnly={loading}
            />
            <PasswordInput
              ref={repeatRef}
              testID="register-repeat"
              label={t('auth.repeat')}
              name="repeat-password"
              value={repeat}
              onChangeText={edit(setRepeat)}
              kind="new"
              enterKeyHint="go"
              error={error}
              readOnly={loading}
            />
            <Rules rows={pwRows} testID="register-pw-rules" />
            {/* Like MobLogin "loading": the label changes, no spinner. */}
            <PlateButton
              type="submit"
              testID="register-submit"
              label={loading ? t('auth.creating') : t('auth.register')}
              disabled={!valid}
              size="lg"
              block
            />
          </Card>
        </div>
      </form>
    </AuthFrame>
  );
}

// MobRegister's own glyphs (not Lucide's check / x).
const RULE_MET = 'M5 12l5 5 9-10';
const RULE_UNMET = 'M6 6l12 12M18 6L6 18';

function Rules({ rows, testID }: { rows: RuleRow<string>[]; testID: string }) {
  const t = useT();
  return (
    <ul className="v2-auth-rules" data-testid={testID}>
      {rows.map((r) => {
        const color = r.met ? 'var(--eos-sage)' : 'var(--eos-dust)';
        return (
          <li key={r.id} className="v2-auth-rule" data-testid={`${testID}-${r.id}-${r.met ? 'met' : 'unmet'}`}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d={r.met ? RULE_MET : RULE_UNMET} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <AppText variant="caption" color={color}>
              {t(r.labelKey)}
            </AppText>
          </li>
        );
      })}
    </ul>
  );
}

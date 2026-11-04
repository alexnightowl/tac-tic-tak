'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';

import { useT } from '@/lib/i18n';
import { Card, Input, PasswordInput, PlateButton } from '@/v2/ui';
import { AuthFrame, AuthSwitch, useShake } from './AuthFrame';
import { authErrorKey, login } from './session';

/**
 * Login (app features/auth/LoginScreen.tsx) on the web's auth flow: the
 * token goes to localStorage, the profile is loaded, then /dashboard.
 * Empty fields are caught before the request; errors sit under the
 * password field and shake the card.
 */
export function LoginScreen() {
  const t = useT();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const { ref: cardRef, shake } = useShake<HTMLDivElement>();

  const fail = (key: string) => {
    setError(t(key));
    shake();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!nickname || !password) {
      fail('auth.err_required');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(nickname, password);
      router.replace('/dashboard');
    } catch (err) {
      fail(authErrorKey(err));
      setLoading(false);
    }
  };

  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (error) setError(null);
  };

  return (
    <AuthFrame
      logo={128}
      subtitle={t('auth.login')}
      testID="login-screen"
      footer={<AuthSwitch prompt={t('auth.no_account')} action={t('auth.create_account')} href="/register" testID="login-to-register" />}
    >
      <form onSubmit={submit} noValidate>
        <div ref={cardRef}>
          <Card className="v2-auth-form">
            <Input
              testID="login-nickname"
              label={t('auth.nickname')}
              name="username"
              value={nickname}
              onChangeText={edit(setNickname)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              onKeyDown={(e) => {
                // The app's returnKeyType "next": Enter moves on instead of submitting.
                if (e.key === 'Enter' && !password) {
                  e.preventDefault();
                  passwordRef.current?.focus();
                }
              }}
              readOnly={loading}
            />
            <PasswordInput
              ref={passwordRef}
              testID="login-password"
              label={t('auth.password')}
              name="password"
              value={password}
              onChangeText={edit(setPassword)}
              enterKeyHint="go"
              error={error}
              readOnly={loading}
            />
            {/* MobLogin "loading": the plate keeps its look and reads "Logging in…". */}
            <PlateButton
              type="submit"
              testID="login-submit"
              label={loading ? t('auth.logging_in') : t('auth.login')}
              size="lg"
              block
            />
          </Card>
        </div>
      </form>
    </AuthFrame>
  );
}

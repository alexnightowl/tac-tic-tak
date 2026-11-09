import { useRef, useState, type ComponentRef } from 'react';
import type { TextInput } from 'react-native';

import { feel } from '@/feel';
import { login } from './session';
import { loginErrorKey, useAuthT } from './strings';
import { useShake } from './useShake';

type TextInputHandle = ComponentRef<typeof TextInput>;

/**
 * The login form's state and submit, shared by the phone LoginScreen and
 * the desktop web layout. On success the auth guard swaps the stack to
 * (app); nothing here navigates.
 */
export function useLoginForm() {
  const t = useAuthT();
  const [nickname, setNicknameState] = useState('');
  const [password, setPasswordState] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInputHandle>(null);
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

  const setNickname = (v: string) => {
    setNicknameState(v);
    if (error) setError(null);
  };
  const setPassword = (v: string) => {
    setPasswordState(v);
    if (error) setError(null);
  };

  return { t, nickname, setNickname, password, setPassword, error, loading, submit, passwordRef, shakeStyle };
}

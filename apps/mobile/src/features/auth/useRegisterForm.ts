import { nicknameRules, passwordRules, registerFormValid, type RuleRow } from '@tac/core/validation';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import type { TextInput } from 'react-native';

import { feel } from '@/feel';
import { useLang } from '@/ui';
import { register } from './session';
import { loginErrorKey, useAuthT } from './strings';
import { useShake } from './useShake';

type TextInputHandle = ComponentRef<typeof TextInput>;

/**
 * The register form (web /register): fields, the live rule rows from
 * @tac/core/validation, the rule-met tick, submit. Shared by the phone
 * RegisterScreen and the desktop web layout. Success signs in and the guard
 * swaps to (app).
 */
export function useRegisterForm() {
  const t = useAuthT();
  const { lang } = useLang();
  const [nickname, setNicknameState] = useState('');
  const [password, setPasswordState] = useState('');
  const [repeat, setRepeatState] = useState('');
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

  return {
    t,
    nickname,
    setNickname: edit(setNicknameState),
    password,
    setPassword: edit(setPasswordState),
    repeat,
    setRepeat: edit(setRepeatState),
    nickRows,
    pwRows,
    valid,
    error,
    loading,
    submit,
    passwordRef,
    repeatRef,
    shakeStyle,
  };
}

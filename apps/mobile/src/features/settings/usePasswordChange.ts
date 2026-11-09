import { useState } from 'react';

import { feel } from '@/feel';
import { useT } from '@/ui/lang';
import { changePassword, formErrorKey } from './api';

/** Web rule set (register + change-password DTO). */
export function passwordRules(next: string) {
  return { len: next.length >= 8, letter: /[A-Za-z]/.test(next), digit: /[0-9]/.test(next) };
}

/**
 * Settings › Account change-password form: the three fields, the live
 * rules, the submit (a wrong current password stays an inline error, never
 * a logout) and the success / error messages. Shared by the phone screen
 * and the desktop pane; `onError` lets the caller shake its form.
 */
export function usePasswordChange(onError?: () => void) {
  const t = useT();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const rules = passwordRules(next);
  const matches = next.length > 0 && next === repeat;
  const valid = current.length > 0 && rules.len && rules.letter && rules.digit && matches && next !== current;
  const mismatch = repeat.length > 0 && next !== repeat ? t('auth.rule_pw_match') : null;

  const submit = async () => {
    if (!valid || saving) return;
    setError(null);
    setOk(false);
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      setOk(true);
    } catch (e) {
      feel.emit('formError');
      onError?.();
      setError(t(formErrorKey(e)));
    } finally {
      setSaving(false);
    }
  };

  /** A field setter that also clears the last error / success line. */
  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (error) setError(null);
    if (ok) setOk(false);
  };

  return {
    current,
    next,
    repeat,
    setCurrent: edit(setCurrent),
    setNext: edit(setNext),
    setRepeat: edit(setRepeat),
    rules,
    valid,
    mismatch,
    saving,
    error,
    ok,
    submit,
  };
}

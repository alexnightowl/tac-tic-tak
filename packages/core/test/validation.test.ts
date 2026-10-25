import { describe, expect, it } from 'vitest';
import {
  changePasswordFormValid, isNicknameValid, isPasswordValid, nicknameRules, nicknameServerValid,
  passwordRules, passwordServerValid, registerFormValid, validatorLength,
} from '../src/validation';

const met = (rows: { met: boolean }[]) => rows.map((r) => r.met);

describe('nickname', () => {
  it('live checklist rows', () => {
    expect(met(nicknameRules(''))).toEqual([false, true, true]);
    expect(met(nicknameRules('ab'))).toEqual([false, true, true]);
    expect(met(nicknameRules('night_owl'))).toEqual([true, true, true]);
    expect(met(nicknameRules('night owl'))).toEqual([true, false, true]);
    expect(met(nicknameRules('night__owl'))).toEqual([true, true, false]);
    expect(met(nicknameRules('a-_b'))).toEqual([true, true, false]);
    expect(met(nicknameRules('x'.repeat(21)))).toEqual([false, true, true]);
    expect(nicknameRules('x').map((r) => r.labelKey)).toEqual([
      'auth.rule_nick_len', 'auth.rule_nick_chars', 'auth.rule_nick_doubles',
    ]);
  });

  it('client and server agree', () => {
    const cases = ['', 'ab', 'abc', 'a_b-c', 'a__b', 'ab-', '-ab', 'Кирило', 'a b c', 'x'.repeat(20), 'x'.repeat(21)];
    for (const n of cases) expect(isNicknameValid(n), n).toBe(nicknameServerValid(n));
  });
});

describe('password', () => {
  it('live checklist rows', () => {
    expect(met(passwordRules(''))).toEqual([false, false, false]);
    expect(met(passwordRules('abcdefgh'))).toEqual([true, true, false]);
    expect(met(passwordRules('12345678'))).toEqual([true, false, true]);
    expect(met(passwordRules('abcd1234'))).toEqual([true, true, true]);
    expect(met(passwordRules('пароль12'))).toEqual([true, false, true]);
  });

  it('server adds the 128 upper bound the checklist lacks', () => {
    const long = 'a1'.repeat(65);
    expect(isPasswordValid(long)).toBe(true);
    expect(passwordServerValid(long)).toBe(false);
    expect(passwordServerValid('a1'.repeat(64))).toBe(true);
  });

  it('validatorLength counts like validator.js isLength', () => {
    expect(validatorLength('abc')).toBe(3);
    expect(validatorLength('a😀')).toBe(2);
    expect(validatorLength('❤️')).toBe(1);
    // A selector only counts as part of the preceding character.
    expect(validatorLength('\uFE0Fab')).toBe(3);
    expect(validatorLength('a\uFE0F\uFE0F')).toBe(2);
    // 7 code points incl. an astral one: too short for the server.
    expect(passwordServerValid('abc123😀')).toBe(false);
    expect(isPasswordValid('abc123😀')).toBe(true);
  });
});

describe('form gates', () => {
  it('register', () => {
    expect(registerFormValid({ nickname: 'owl', password: 'abcd1234', repeat: 'abcd1234' })).toBe(true);
    expect(registerFormValid({ nickname: 'owl', password: 'abcd1234', repeat: 'abcd1235' })).toBe(false);
    expect(registerFormValid({ nickname: '', password: 'abcd1234', repeat: 'abcd1234' })).toBe(false);
  });

  it('change password', () => {
    expect(changePasswordFormValid({ current: 'old', next: 'abcd1234', repeat: 'abcd1234' })).toBe(true);
    expect(changePasswordFormValid({ current: '', next: 'abcd1234', repeat: 'abcd1234' })).toBe(false);
    expect(changePasswordFormValid({ current: 'abcd1234', next: 'abcd1234', repeat: 'abcd1234' })).toBe(false);
  });
});

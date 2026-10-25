// Nickname and password rules. Two layers, kept separate on purpose:
// - the *live checklist* rows exactly as app/register/page.tsx and the
//   settings change-password form evaluate them;
// - the *server* rules from apps/backend/src/auth/dto.ts (class-validator),
//   which are what actually accept or reject the request.

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const NICK_RE = /^[A-Za-z0-9_-]+$/;
export const NICK_NO_DOUBLES_RE = /^(?!.*[-_]{2}).+$/;
export const PW_LETTER_RE = /[A-Za-z]/;
export const PW_DIGIT_RE = /[0-9]/;

export type RuleRow<Id extends string> = { id: Id; met: boolean; labelKey: string };

export type NicknameRuleId = 'len' | 'chars' | 'doubles';
export type PasswordRuleId = 'len' | 'letter' | 'digit';

/** Register-page checklist. `chars` and `doubles` read as met while the
 *  field is empty so only the length row is red before typing. */
export function nicknameRules(nickname: string): RuleRow<NicknameRuleId>[] {
  return [
    { id: 'len',     met: nickname.length >= NICKNAME_MIN && nickname.length <= NICKNAME_MAX, labelKey: 'auth.rule_nick_len' },
    { id: 'chars',   met: nickname.length === 0 || NICK_RE.test(nickname),                    labelKey: 'auth.rule_nick_chars' },
    { id: 'doubles', met: nickname.length === 0 || NICK_NO_DOUBLES_RE.test(nickname),         labelKey: 'auth.rule_nick_doubles' },
  ];
}

// web bug: the live checklist has no upper bound, so a >128-char password
// shows all green and the server then answers "password must be at least
// 8 characters". Kept as-is; passwordServerValid() has the real bound.
export function passwordRules(password: string): RuleRow<PasswordRuleId>[] {
  return [
    { id: 'len',    met: password.length >= PASSWORD_MIN, labelKey: 'auth.rule_pw_len' },
    { id: 'letter', met: PW_LETTER_RE.test(password),     labelKey: 'auth.rule_pw_letter' },
    { id: 'digit',  met: PW_DIGIT_RE.test(password),      labelKey: 'auth.rule_pw_digit' },
  ];
}

export function isNicknameValid(nickname: string): boolean {
  return nicknameRules(nickname).every((r) => r.met) && nickname.length > 0;
}

export function isPasswordValid(password: string): boolean {
  return passwordRules(password).every((r) => r.met);
}

/** Register submit gate, as on the web page. */
export function registerFormValid(f: { nickname: string; password: string; repeat: string }): boolean {
  const repeatValid = f.repeat === f.password && f.repeat.length > 0;
  return isNicknameValid(f.nickname) && isPasswordValid(f.password) && repeatValid;
}

/** Settings change-password submit gate. */
export function changePasswordFormValid(f: { current: string; next: string; repeat: string }): boolean {
  return (
    f.current.length > 0 &&
    f.next.length >= PASSWORD_MIN &&
    PW_LETTER_RE.test(f.next) &&
    PW_DIGIT_RE.test(f.next) &&
    f.next === f.repeat &&
    f.next !== f.current
  );
}

// ---- Server-side equivalents (auth/dto.ts) -------------------------------

/** validator.js 13.15 isLength, which class-validator's @Length uses:
 *  counts astral characters once and drops a presentation selector only
 *  when it follows another character (regexes copied verbatim). */
export function validatorLength(str: string): number {
  const presentationSequences = str.match(/[^\uFE0F\uFE0E][\uFE0F\uFE0E]/g) || [];
  const surrogatePairs = str.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) || [];
  return str.length - presentationSequences.length - surrogatePairs.length;
}

/** RegisterDto.nickname. */
export function nicknameServerValid(nickname: string): boolean {
  const len = validatorLength(nickname);
  return (
    len >= NICKNAME_MIN && len <= NICKNAME_MAX &&
    NICK_RE.test(nickname) &&
    NICK_NO_DOUBLES_RE.test(nickname)
  );
}

/** RegisterDto.password and ChangePasswordDto.newPassword. */
export function passwordServerValid(password: string): boolean {
  const len = validatorLength(password);
  return (
    len >= PASSWORD_MIN && len <= PASSWORD_MAX &&
    PW_LETTER_RE.test(password) &&
    PW_DIGIT_RE.test(password)
  );
}

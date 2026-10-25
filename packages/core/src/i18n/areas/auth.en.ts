// auth area, en. Keys from the web dict (apps/frontend/src/lib/i18n.ts) keep
// their web text verbatim; mobile-only keys follow. Edit only your area's files.
import type { Dict } from '../types';

export const authEn: Dict = {
  'auth.login': 'Log in',
  'auth.register': 'Sign up',
  'auth.nickname': 'Nickname',
  'auth.password': 'Password',
  'auth.repeat': 'Repeat password',
  'auth.no_account': 'No account?',
  'auth.have_account': 'Already have one?',
  'auth.create_account': 'Create account',
  'auth.creating': 'Creating…',
  'auth.logging_in': 'Logging in…',
  'auth.rule_nick_len': '3–20 characters',
  'auth.rule_nick_chars': 'Letters, digits, _ or -',
  'auth.rule_nick_doubles': 'No consecutive _ or -',
  'auth.rule_pw_len': 'At least 8 characters',
  'auth.rule_pw_letter': 'Contains a letter',
  'auth.rule_pw_digit': 'Contains a digit',
  'auth.rule_pw_match': 'Passwords must match',

  // Phase 2 mobile-only copy (was in local strings.ts tables).
  'auth.err_invalid': 'Wrong nickname or password',
  'auth.err_required': 'Enter your nickname and password',
  'auth.err_network': 'Can’t reach the server. Check your connection.',
  'auth.err_timeout': 'The server is taking too long. Try again.',
  'auth.err_generic': 'Something went wrong. Try again.',
  'auth.err_taken': 'That nickname is already taken',
};
